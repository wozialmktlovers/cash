// Lo que comparten las dos rutas del paso «Elegir los temas del mes»
// (`…/lotes/[id]/temas`) y la que autoriza y lanza (`…/lotes/[id]/generar`):
// quién puede, que el lote esté abierto, que el cliente tenga paquete, que
// estén hechas la investigación y el mapa de pilares (dependencia dura) y qué
// piezas se quedan según el modo. Devuelve o la respuesta de error ya armada
// (con su código) o el contexto listo, para que las rutas solo decidan lo suyo.

import { loteVisible, type Cliente, type Lote } from '@/lib/visibilidad';
import { puedeOperarCliente, type UsuarioSesion } from '@/lib/permisos';
import { etapasDelCliente } from '@/flujo/servicio';
import { dependenciasDelMes } from '@/flujo/dependencias';
import { leerPaquete } from '@/contenido/paquete';
import type { Paquete } from '@/contenido/reglas';
import { MODOS, type Modo } from './plan';
import { cargarBancoDelMes, type BancoDelMes } from './banco-servicio';
import { puedeElegirTemas, RAZON_SIN_PERMISO_TEMAS } from './permiso';
import { situacionDelMes } from './propuesta';

export const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export type ContextoMes = {
  lote: Lote;
  cliente: Cliente;
  paquete: Paquete;
  banco: BancoDelMes;
  modo: Modo;
  incluirConArte: boolean;
  situacion: ReturnType<typeof situacionDelMes>;
};

/**
 * `cuerpo.modo` es obligatorio si el mes ya tiene piezas (la API no adivina si
 * completar o reemplazar); con el mes vacío, `completar`.
 */
export async function contextoDeMes(usuario: UsuarioSesion, loteId: string, cuerpo: Record<string, unknown>): Promise<ContextoMes | Response> {
  const visible = await loteVisible(usuario, loteId);
  if (!visible || !puedeOperarCliente(usuario, visible.cliente)) {
    return json({ ok: false, errores: ['El lote no existe'] }, 404);
  }
  const { lote, cliente } = visible;

  // Proponer, editar y autorizar temas es del flujo de la etapa: sus
  // responsables (contenido y diseño) y el admin. Los demás operadores ven.
  if (!(await puedeElegirTemas(usuario, cliente.id))) {
    return json({ ok: false, errores: [RAZON_SIN_PERMISO_TEMAS] }, 403);
  }

  if (lote.estado !== 'en_proceso') {
    return json({ ok: false, errores: ['Solo se genera un mes abierto y en proceso. Este ya se compartió o se aprobó.'] }, 409);
  }

  const paquete = leerPaquete(cliente.paquete);
  if (!paquete) {
    return json({
      ok: false,
      errores: ['Este cliente no tiene paquete mensual. Defínelo primero en su ficha: la IA genera exactamente ese paquete.'],
      enlace: `/clientes/${cliente.id}#paquete`,
    }, 409);
  }

  // Dependencia dura: investigación con datos Y mapa de pilares con temas.
  const dependencias = await dependenciasDelMes(cliente.id, await etapasDelCliente(cliente.id));
  if (!dependencias.ok) return json({ ok: false, errores: [dependencias.razon] }, 409);

  const banco = await cargarBancoDelMes(cliente.id, lote.id);
  if (!banco) return json({ ok: false, errores: ['Este cliente no tiene un mapa de pilares con temas. El mes sale de ahí.'] }, 409);

  let modo: Modo = 'completar';
  if (banco.piezasLote.length > 0) {
    if (!(MODOS as readonly unknown[]).includes(cuerpo.modo)) {
      return json({ ok: false, errores: ['El mes ya tiene piezas: elige si completar lo que falta del paquete o reemplazar las piezas sin revisar.'] }, 400);
    }
    modo = cuerpo.modo as Modo;
  }
  const incluirConArte = modo === 'reemplazar' && cuerpo.incluirConArte === true;
  const situacion = situacionDelMes({ paquete, modo, incluirConArte, piezasLote: banco.piezasLote });
  return { lote, cliente, paquete, banco, modo, incluirConArte, situacion };
}

/** Lee el cuerpo JSON opcional de una petición: `{}` si viene vacío, una respuesta 400 si no es un objeto JSON. */
export async function leerCuerpo(request: Request): Promise<Record<string, unknown> | Response> {
  const texto = await request.text();
  if (!texto.trim()) return {};
  try {
    const v = JSON.parse(texto);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* cae al 400 */ }
  return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
}

/** Las filas que llegan del navegador, ya con su forma (el contenido lo valida `validarSeleccion`). */
export function leerFilas(v: unknown): { ref: number; formato: any; fecha: string; temaId: string | null }[] | null {
  if (!Array.isArray(v)) return null;
  const filas = [];
  for (const f of v) {
    if (!f || typeof f !== 'object') return null;
    const r = f as Record<string, unknown>;
    if (typeof r.ref !== 'number' || !Number.isInteger(r.ref) || typeof r.formato !== 'string' || typeof r.fecha !== 'string') return null;
    if (r.temaId != null && typeof r.temaId !== 'string') return null;
    filas.push({ ref: r.ref, formato: r.formato, fecha: r.fecha, temaId: (r.temaId as string | null | undefined) ?? null });
  }
  return filas;
}
