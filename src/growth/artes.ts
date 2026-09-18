// El arte de los anuncios del manual de campaña: quién lo sube, quién lo quita
// y quién lo ve, por cada una de las tres puertas por las que sale el manual.
//
// Las reglas de qué hueco recibe qué están en `./artes-reglas.ts`; las
// consultas, en `./artes-consultas.ts`. Aquí se decide.
//
// Tres reglas de la casa que se repiten en cada función:
//
// 1. **Todo lo que falla por permiso es `null` (y la ruta lo traduce a 404).**
//    Un arte de otro cliente, uno que no existe y uno cuyo id no tiene forma
//    de UUID se contestan igual, para que nadie averigüe qué existe probando.
// 2. **El id del arte nunca basta.** Siempre se pide junto con el documento
//    por el que se llega —el manual, la etapa del portal, el token—, y el arte
//    tiene que colgar de ESE documento.
// 3. **Subir o quitar arte no toca la etapa ni crea versión.** No es texto del
//    documento (ver `growthArtes`, src/db/schema.ts).

import { puedeOperarCliente, puedeVerCliente, type UsuarioSesion } from '@/lib/permisos';
import { esUuid } from '@/lib/visibilidad';
import { guardarArchivo, borrarArchivo, tipoReal, extensionDe, MAX_BYTES } from '@/lib/files';
import { enlaceWeb } from '@/contenido/reglas';
import * as consultas from './artes-consultas';
import { acomodarArtes, destinoDeSubida, type ArteGrowth, type ClaseArte } from './artes-reglas';

/** Los creativos del manual tal como están guardados; lo que no tenga forma se lee como vacío. */
function creativosDe(datos: unknown): { formato: string }[] {
  const lista = (datos as { creativos?: unknown } | null)?.creativos;
  if (!Array.isArray(lista)) return [];
  return lista.map((c) => ({ formato: typeof (c as { formato?: unknown })?.formato === 'string' ? (c as { formato: string }).formato : '' }));
}

/** El manual, si `u` puede operar a su cliente (admin, u operador asignado). */
async function manualOperable(u: UsuarioSesion, growthId: string) {
  if (!esUuid(growthId)) return null;
  const m = await consultas.manualConCliente(growthId);
  if (!m || !puedeOperarCliente(u, m.cliente)) return null;
  return m;
}

/** Lo que hace falta para servir un arte desde el disco. */
export type ArteServible = { clientId: string; ruta: string; mime: string; nombreOriginal: string };

function servible(clientId: string, a: consultas.ArteGuardado | null): ArteServible | null {
  if (!a || a.tipo !== 'archivo' || !a.ruta || !a.mime) return null;
  return { clientId, ruta: a.ruta, mime: a.mime, nombreOriginal: a.nombreOriginal ?? `arte.${extensionDe(a.mime)}` };
}

/**
 * Para el equipo, desde la vista interna del manual: admin u operador
 * asignado. El usuario del cliente no llega aquí (la API de growth no está en
 * sus rutas) y, aunque llegara, `puedeOperarCliente` lo deja fuera: él ve el
 * arte por su portal.
 */
export async function arteParaEquipo(u: UsuarioSesion, growthId: string, arteId: string): Promise<ArteServible | null> {
  if (!esUuid(arteId)) return null;
  const m = await manualOperable(u, growthId);
  if (!m) return null;
  return servible(m.cliente.id, await consultas.arteDelManual(m.growthId, arteId));
}

/**
 * Para el portal del cliente: `/portal/documentos/{etapaId}/arte/{arteId}`.
 *
 * El mismo criterio que la página del documento (`clientePortal` más «lista
 * para el cliente»): el cliente, en su propia etapa; admin u operador
 * asignado, en vista previa con `?cliente=` de ESE cliente. Y la etapa tiene
 * que tener una versión autorizada de un manual: el arte que se sirve es de
 * ese manual y de ningún otro.
 */
export async function arteParaPortal(
  u: UsuarioSesion,
  query: URLSearchParams,
  etapaId: string,
  arteId: string,
): Promise<ArteServible | null> {
  if (!esUuid(etapaId) || !esUuid(arteId)) return null;
  const etapa = await consultas.etapaConVersion(etapaId);
  if (!etapa) return null;
  const c = await consultas.cliente(etapa.clientId);
  if (!c || !puedeVerCliente(u, c)) return null;
  // Personal del Studio: solo en vista previa, y del cliente de la etapa.
  if (u.rol !== 'cliente' && query.get('cliente') !== c.id) return null;
  if (!etapa.contratada || etapa.interna || !etapa.version || etapa.version.documentoTipo !== 'growth') return null;
  return servible(c.id, await consultas.arteDelManual(etapa.version.documentoId, arteId));
}

/**
 * Para el enlace público: `/p/{negocio}/{token}/arte/{arteId}`. El token tiene
 * que estar vigente (existe, no revocado), ser de un manual de campaña, y el
 * arte tiene que ser de ESE manual.
 */
export async function arteParaEnlace(token: string, arteId: string): Promise<ArteServible | null> {
  if (!esUuid(arteId)) return null;
  const link = await consultas.enlacePublico(token);
  if (!link || link.documentoTipo !== 'growth') return null;
  const m = await consultas.manualConCliente(link.documentoId);
  if (!m) return null;
  return servible(m.cliente.id, await consultas.arteDelManual(m.growthId, arteId));
}

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };

/** Lo que llega para subir: o un archivo, o un enlace. */
export type Subida = {
  creativo: number;
  /** El hueco; `null` en un carrusel es «agregar tarjeta». */
  orden: number | null;
} & ({ archivo: { nombre: string; buf: Buffer } } | { url: string });

const NO_EXISTE = { ok: false as const, status: 404, error: 'El manual no existe' };

/**
 * Sube (o enlaza) el arte de un hueco. Si el hueco ya tenía arte, lo
 * reemplaza y borra el archivo anterior del disco.
 */
export async function subirArte(u: UsuarioSesion, growthId: string, s: Subida): Promise<Resultado<ArteGrowth>> {
  const m = await manualOperable(u, growthId);
  if (!m) return NO_EXISTE;

  const creativos = creativosDe(m.datos);
  if (!Number.isInteger(s.creativo) || s.creativo < 0 || s.creativo >= creativos.length) {
    return { ok: false, status: 400, error: 'Ese anuncio ya no existe en el manual. Recarga la página.' };
  }
  if (s.orden !== null && (!Number.isInteger(s.orden) || s.orden < 0 || s.orden > 99)) {
    return { ok: false, status: 400, error: 'Ese arte no existe en este anuncio.' };
  }

  // Qué es lo que llegó, visto por su contenido y no por su nombre.
  let clase: ClaseArte;
  let mime: string | null = null;
  let url: string | null = null;
  if ('archivo' in s) {
    if (s.archivo.buf.byteLength === 0) return { ok: false, status: 400, error: 'El archivo está vacío.' };
    if (s.archivo.buf.byteLength > MAX_BYTES) return { ok: false, status: 400, error: 'El archivo supera 25 MB.' };
    mime = tipoReal(s.archivo.buf);
    if (!mime) return { ok: false, status: 400, error: 'El archivo no es una imagen PNG o JPEG ni un video MP4.' };
    clase = mime === 'video/mp4' ? 'video' : 'imagen';
  } else {
    const limpio = s.url.trim();
    // La misma lista blanca que el arte de las piezas del mes: http y https.
    if (!limpio || limpio.length > 2000 || !enlaceWeb(limpio)) {
      return { ok: false, status: 400, error: 'El enlace debe empezar con http:// o https://.' };
    }
    url = limpio;
    clase = 'enlace';
  }

  const formato = creativos[s.creativo].formato;
  const existentes = acomodarArtes(creativos, await consultas.artesDelManual(m.growthId)).get(s.creativo) ?? [];
  const maxGuardado = formato === 'carrusel' && s.orden === null ? await consultas.maxOrden(m.growthId, s.creativo) : -1;
  const destino = destinoDeSubida(formato, s.orden, clase, existentes, maxGuardado);
  if (!destino.ok) return { ok: false, status: 400, error: destino.error };

  let rutaNueva: string | null = null;
  try {
    let puesto: { arte: ArteGrowth; rutaAnterior: string | null };
    if ('archivo' in s && mime) {
      // El nombre con que se guarda lleva la extensión del tipo REAL: un
      // `foto.png` que en verdad es JPEG queda como `.jpg` en el disco.
      ({ ruta: rutaNueva } = await guardarArchivo(m.cliente.id, `arte.${extensionDe(mime)}`, s.archivo.buf, mime));
      puesto = await consultas.ponerArte({
        growthId: m.growthId, creativo: s.creativo, orden: destino.orden, autorId: u.id,
        tipo: 'archivo', ruta: rutaNueva, mime, nombreOriginal: nombreLimpio(s.archivo.nombre, mime), bytes: s.archivo.buf.byteLength,
      });
    } else {
      puesto = await consultas.ponerArte({
        growthId: m.growthId, creativo: s.creativo, orden: destino.orden, autorId: u.id, tipo: 'enlace', url: url!,
      });
    }
    if (puesto.rutaAnterior) await borrarSinTronar(puesto.rutaAnterior);
    return { ok: true, datos: puesto.arte };
  } catch (e) {
    if (rutaNueva) await borrarSinTronar(rutaNueva);
    // Dos subidas a la vez al mismo hueco: la segunda choca con el `unique`.
    // Drizzle envuelve el error de Postgres en `cause`; se miran los dos.
    const codigo = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (codigo === '23505') {
      return { ok: false, status: 409, error: 'Alguien más acaba de cambiar este arte. Recarga la página.' };
    }
    console.error('[growth/artes] no se pudo guardar el arte:', e);
    return { ok: false, status: 500, error: 'No se pudo guardar el arte.' };
  }
}

/** Quita un arte del manual y borra su archivo. */
export async function quitarArte(u: UsuarioSesion, growthId: string, arteId: string): Promise<Resultado<{ id: string }>> {
  if (!esUuid(arteId)) return { ok: false, status: 404, error: 'El arte no existe' };
  const m = await manualOperable(u, growthId);
  if (!m) return NO_EXISTE;
  const borrado = await consultas.quitarArte(m.growthId, arteId);
  if (!borrado) return { ok: false, status: 404, error: 'El arte no existe' };
  // La fila ya no está; si el disco falla, un archivo huérfano molesta menos
  // que una fila que apunta a la nada (mismo criterio que la ficha).
  if (borrado.ruta) await borrarSinTronar(borrado.ruta);
  return { ok: true, datos: { id: arteId } };
}

async function borrarSinTronar(ruta: string): Promise<void> {
  try {
    await borrarArchivo(ruta);
  } catch (e) {
    console.error(`[growth/artes] no se pudo borrar ${ruta}:`, e);
  }
}

/** El nombre original, sin rutas ni caracteres de control, y con la extensión de su tipo real. */
function nombreLimpio(nombre: string, mime: string): string {
  const base = nombre.split(/[\\/]/).pop()!.replace(/[ -]/g, '').trim().slice(0, 120);
  const sinExt = base.replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'arte';
  return `${sinExt}.${extensionDe(mime)}`;
}
