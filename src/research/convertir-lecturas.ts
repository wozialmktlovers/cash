import { eq } from 'drizzle-orm';
import { db, researchResults, clients, clientLinks, clientFiles, clienteEtapas } from '@/db';
import { armarContexto } from './contexto';
import { correrLectura, type PreviosLectura } from './agents/lectura';
import { calcularCosto, leerTopeUsd } from '@/lib/cost';
import { MENSAJE_JSON_INVALIDO, MENSAJE_DECLINO } from './claude';
import { investigacionUtil } from '@/lib/precheck';

const ORIGINALES = ['competencia', 'audiencia', 'canales', 'mercado', 'sintesis'] as const;

/**
 * Una fila se convierte si nunca tuvo lectura y hay algo que explicar. Una
 * lectura vacía ya es una decisión tomada: reintentarla gastaría en cada arranque.
 */
export function necesitaLectura(datos: unknown): boolean {
  if (!datos || typeof datos !== 'object') return false;
  const d = datos as Record<string, any>;
  if (d.lectura) return false;
  return ORIGINALES.some((k) => d[k]?.estado === 'ok');
}

/**
 * La respuesta llegó pero no sirve: no mejora reintentándola mañana. Cualquier
 * otro error (saldo, red, 5xx) sí puede resolverse solo, así que se reintenta.
 * Los dos prefijos vienen de `claude.ts`, que es quien de verdad lanza estos
 * errores: así el texto nunca se desalinea entre las dos partes.
 */
export function esRespuestaInvalida(error: unknown): boolean {
  const m = error instanceof Error ? error.message : '';
  return m.includes(MENSAJE_JSON_INVALIDO) || m.includes(MENSAJE_DECLINO);
}

export function previosDesde(datos: unknown): PreviosLectura {
  const d = (datos ?? {}) as Record<string, any>;
  return Object.fromEntries(
    ORIGINALES.filter((k) => d[k]?.estado === 'ok').map((k) => [k, d[k].datos]),
  ) as PreviosLectura;
}

type FilaResearch = { id: string; clientId: string; datos: unknown; version: number };
type EtapaInvestigacion = { clientId: string; documentoTipo: string | null; documentoId: string | null };

/**
 * Qué fila convertir, cliente por cliente, y en qué orden (punto 2:
 * "Prioridad y alcance"). Primero la investigación ligada a la etapa del
 * cliente (`cliente_etapas.documentoId`, si existe y de verdad apunta a un
 * `research_results`): es la que el cliente ve hoy. Sin enlace, la más
 * reciente con datos de ese cliente — la misma regla de `investigacionUtil`
 * que ya usan growth y pilares, para no inventar un criterio nuevo. Nunca se
 * eligen dos filas del mismo cliente, así que las versiones viejas sin
 * enlace nunca se convierten.
 *
 * Orden estable: primero todos los clientes con enlace (para no dejarlos
 * esperando detrás de una cola de clientes donde solo se está adivinando la
 * versión vigente), después el resto; dentro de cada grupo, por id de
 * cliente, no por el orden en que llegaron las filas de la base.
 */
export function seleccionarLecturasAConvertir(
  filas: FilaResearch[],
  etapas: EtapaInvestigacion[],
): FilaResearch[] {
  const porCliente = new Map<string, FilaResearch[]>();
  for (const f of filas) {
    (porCliente.get(f.clientId) ?? porCliente.set(f.clientId, []).get(f.clientId)!).push(f);
  }

  const ligadoDe = new Map<string, string>();
  for (const e of etapas) {
    if (e.documentoTipo === 'research' && e.documentoId) ligadoDe.set(e.clientId, e.documentoId);
  }

  const conEnlace: FilaResearch[] = [];
  const sinEnlace: FilaResearch[] = [];

  const clientesOrdenados = [...porCliente.keys()].sort((a, b) => a.localeCompare(b));
  for (const clientId of clientesOrdenados) {
    const filasCliente = porCliente.get(clientId)!;
    const idLigado = ligadoDe.get(clientId);
    const ligada = idLigado ? filasCliente.find((f) => f.id === idLigado) : undefined;
    const objetivo = ligada ?? investigacionUtil(filasCliente);
    if (!objetivo || !necesitaLectura(objetivo.datos)) continue;
    (ligada ? conEnlace : sinEnlace).push(objetivo);
  }

  return [...conEnlace, ...sinEnlace];
}

export async function convertirLecturasPendientes(opciones: {
  correr?: typeof correrLectura;
  tope?: number;
  modelo?: string;
  log?: (m: string) => void;
} = {}) {
  const correr = opciones.correr ?? correrLectura;
  const tope = opciones.tope ?? leerTopeUsd(process.env.COST_LIMIT_CONVERSION_USD, 10, 'COST_LIMIT_CONVERSION_USD');
  const modelo = opciones.modelo ?? (process.env.MODEL_SYNTHESIS || 'claude-opus-5');
  const log = opciones.log ?? ((m: string) => console.log(m));

  const filas = await db.select({
    id: researchResults.id, clientId: researchResults.clientId,
    datos: researchResults.datos, version: researchResults.version,
  }).from(researchResults);
  const etapas = await db.select({
    clientId: clienteEtapas.clientId, documentoTipo: clienteEtapas.documentoTipo, documentoId: clienteEtapas.documentoId,
  }).from(clienteEtapas).where(eq(clienteEtapas.etapa, 'investigacion'));
  const pendientes = seleccionarLecturasAConvertir(filas, etapas);

  let gasto = 0, convertidas = 0, invalidas = 0;

  for (const fila of pendientes) {
    if (gasto >= tope) break;

    const [cliente] = await db.select().from(clients).where(eq(clients.id, fila.clientId)).limit(1);
    if (!cliente) continue;
    const links = await db.select().from(clientLinks).where(eq(clientLinks.clientId, fila.clientId));
    const archivos = await db.select().from(clientFiles).where(eq(clientFiles.clientId, fila.clientId));
    const ctx = armarContexto(cliente, links, archivos);
    const datos = fila.datos as Record<string, unknown>;

    try {
      const r = await correr(ctx, previosDesde(datos), (e, s) => {
        gasto += calcularCosto(modelo, e, s);
        return gasto < tope;
      });
      await db.update(researchResults)
        .set({ datos: { ...datos, lectura: { estado: 'ok', datos: r.datos } } })
        .where(eq(researchResults.id, fila.id));
      convertidas++;
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      if (esRespuestaInvalida(e)) {
        await db.update(researchResults)
          .set({ datos: { ...datos, lectura: { estado: 'vacio', razon: 'No se pudo redactar la lectura para el cliente.' } } })
          .where(eq(researchResults.id, fila.id));
        invalidas++;
        log(`[lecturas] ${fila.id}: respuesta inválida, no se reintentará`);
        continue;
      }
      // Sin saldo o sin red no tiene caso seguir: se reintenta en el siguiente arranque.
      log(`[lecturas] se detiene: ${mensaje}`);
      break;
    }
  }

  const restantes = pendientes.length - convertidas - invalidas;
  log(`[lecturas] convertidas ${convertidas}, inválidas ${invalidas}, pendientes ${restantes}, gasto $${gasto.toFixed(2)} USD`);
  return { convertidas, invalidas, pendientes: restantes, gasto };
}
