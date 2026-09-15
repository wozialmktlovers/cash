// Edición sobre el documento y versiones (spec §3, «Versiones y edición sobre
// el documento»). Funciones puras: sin acceso a base de datos. El servicio
// (servicio.ts, guardarVersion) y las rutas de API se apoyan en estas para
// aplicar los cambios, validarlos contra el esquema del tipo y decidir quién
// puede editar.

import { z } from 'zod';
import { investigacionSchema } from '@/research/schemas';
import { estrategiaSchema, temaGeneradoSchema } from '@/pilares/schemas';
import { growthSchema } from '@/growth/schemas';
import type { Estado, Rol, TipoDocumento } from './reglas';

export type Cambio = { ruta: string; valor: string };

const SEGMENTOS_PROHIBIDOS = new Set(['__proto__', 'constructor', 'prototype']);
export const MAX_CAMBIOS = 200;
export const MAX_VALOR = 2000;

/** Un segmento de índice de arreglo: solo dígitos, sin ceros a la izquierda salvo "0". */
function indiceDeArreglo(segmento: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(segmento)) return null;
  return Number(segmento);
}

function partesDeRuta(ruta: unknown): string[] | null {
  if (typeof ruta !== 'string' || ruta.trim() === '') return null;
  const partes = ruta.split('.');
  if (partes.some((p) => p === '')) return null;
  return partes;
}

/** `true` si alguno de los segmentos es una llave peligrosa, a cualquier profundidad. */
function tieneSegmentoProhibido(partes: string[]): boolean {
  return partes.some((p) => SEGMENTOS_PROHIBIDOS.has(p));
}

/**
 * Aplica una lista de cambios `{ ruta, valor }` sobre una copia profunda de
 * `datos`. Pura: nunca muta la entrada (usa `structuredClone`). Cada ruta usa
 * puntos; los segmentos numéricos sobre un arreglo son índices (enteros,
 * dentro de rango). Se rechaza toda la operación (ningún cambio se aplica) si
 * cualquier cambio de la lista falla alguna de estas condiciones:
 * - más de `MAX_CAMBIOS` cambios;
 * - un segmento `__proto__`, `constructor` o `prototype`, a cualquier profundidad;
 * - una ruta que no exista en `datos` (segmento intermedio o final);
 * - un índice de arreglo que no sea un entero válido dentro de rango;
 * - un destino que no sea actualmente un string;
 * - un `valor` que no sea string o que pase de `MAX_VALOR` caracteres.
 */
export function aplicarCambios(datos: unknown, cambios: Cambio[]): { ok: true; datos: unknown } | { ok: false; errores: string[] } {
  if (!Array.isArray(cambios)) return { ok: false, errores: ['El cuerpo debe traer una lista de cambios'] };
  if (cambios.length > MAX_CAMBIOS) return { ok: false, errores: [`No se pueden aplicar más de ${MAX_CAMBIOS} cambios a la vez`] };

  const copia = structuredClone(datos);
  const errores: string[] = [];

  for (const cambio of cambios) {
    if (!cambio || typeof cambio !== 'object') { errores.push('Cambio inválido'); continue; }
    const { ruta, valor } = cambio as Cambio;

    const partes = partesDeRuta(ruta);
    if (!partes) { errores.push(`Ruta inválida: ${String(ruta)}`); continue; }
    if (tieneSegmentoProhibido(partes)) { errores.push(`Ruta no permitida: ${ruta}`); continue; }
    if (typeof valor !== 'string') { errores.push(`El valor de «${ruta}» debe ser texto`); continue; }
    if (valor.length > MAX_VALOR) { errores.push(`El valor de «${ruta}» supera los ${MAX_VALOR} caracteres`); continue; }

    // Navega hasta el contenedor del último segmento, usando SIEMPRE
    // `hasOwnProperty` sobre el propio objeto (nunca la cadena de prototipos)
    // para decidir si una llave existe.
    let objetivo: unknown = copia;
    let rutaValida = true;
    for (let i = 0; i < partes.length - 1; i++) {
      const parte = partes[i];
      if (Array.isArray(objetivo)) {
        const indice = indiceDeArreglo(parte);
        if (indice === null || indice < 0 || indice >= objetivo.length) { rutaValida = false; break; }
        objetivo = objetivo[indice];
      } else if (objetivo && typeof objetivo === 'object' && Object.prototype.hasOwnProperty.call(objetivo, parte)) {
        objetivo = (objetivo as Record<string, unknown>)[parte];
      } else {
        rutaValida = false; break;
      }
    }
    if (!rutaValida) { errores.push(`La ruta «${ruta}» no existe`); continue; }

    const ultima = partes[partes.length - 1];
    if (Array.isArray(objetivo)) {
      const indice = indiceDeArreglo(ultima);
      if (indice === null || indice < 0 || indice >= objetivo.length) { errores.push(`La ruta «${ruta}» no existe`); continue; }
      if (typeof objetivo[indice] !== 'string') { errores.push(`«${ruta}» no apunta a un texto`); continue; }
      objetivo[indice] = valor;
    } else if (objetivo && typeof objetivo === 'object' && Object.prototype.hasOwnProperty.call(objetivo, ultima)) {
      const contenedor = objetivo as Record<string, unknown>;
      if (typeof contenedor[ultima] !== 'string') { errores.push(`«${ruta}» no apunta a un texto`); continue; }
      contenedor[ultima] = valor;
    } else {
      errores.push(`La ruta «${ruta}» no existe`); continue;
    }
  }

  if (errores.length) return { ok: false, errores };
  return { ok: true, datos: copia };
}

/** Un mensaje por incidencia, con la ruta del campo delante (`a.b.0.c: mensaje`) cuando el issue trae una — mismo formato que `validarCliente`. */
function mensajes(error: z.ZodError): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message));
}

/** `true` si `datos.lectura` (cuando existe) cumple hoy `lecturaSchema`. */
function lecturaValida(datos: unknown): boolean {
  const lectura = (datos as { lectura?: unknown } | null | undefined)?.lectura;
  return investigacionSchema.shape.lectura.safeParse(lectura).success;
}

/**
 * Valida `datos` contra el esquema del tipo, tras aplicar los cambios:
 * - `research`: el documento contra `investigacionSchema`, salvo `lectura`.
 *   `lectura` se revisa aparte, y solo si YA era válida en `datosAnteriores`
 *   (el `datos` previo al cambio, cuando se conoce): una investigación vieja
 *   (v1, sin `cifras`) cuya lectura no cumple el esquema actual se lee con el
 *   respaldo de síntesis/detalle (`renderizarInvestigacion`), y no debe
 *   quedar imposible de editar en el resto por una `lectura` que ya venía
 *   rota de antes — B6, ronda de arreglos 1, punto 6. Si `datosAnteriores` no
 *   se pasa (pruebas puras, por ejemplo), se revalida por seguridad. Los
 *   nodos `data-editable` de la lectura se conservan en el render tal cual
 *   (no se ocultan): si el documento SÍ tenía una lectura válida, seguirá
 *   pudiendo editarse y seguirá exigiéndose que el cambio no la rompa.
 * - `pilares`: `datos.estrategia` contra `estrategiaSchema` y cada tema del
 *   banco (`datos.pilares[].subcategorias[].temas[]`, saltando los pilares
 *   `vacio`) contra `temaGeneradoSchema`.
 * - `growth`: `growthSchema.partial().passthrough()` (el documento puede
 *   venir incompleto: cada agente escribe su trozo).
 */
export function validarDocumento(
  tipo: TipoDocumento,
  datos: unknown,
  datosAnteriores?: unknown,
): { ok: true } | { ok: false; errores: string[] } {
  if (tipo === 'research') {
    const errores: string[] = [];

    const sinLectura = investigacionSchema.omit({ lectura: true });
    const r = sinLectura.safeParse(datos);
    if (!r.success) errores.push(...mensajes(r.error));

    if (datosAnteriores === undefined || lecturaValida(datosAnteriores)) {
      const rl = investigacionSchema.shape.lectura.safeParse((datos as { lectura?: unknown } | null | undefined)?.lectura);
      if (!rl.success) errores.push(...mensajes(rl.error));
    }

    if (errores.length) return { ok: false, errores };
    return { ok: true };
  }

  if (tipo === 'pilares') {
    const errores: string[] = [];
    const d = (datos ?? {}) as { estrategia?: unknown; pilares?: unknown };

    const re = estrategiaSchema.safeParse(d.estrategia);
    if (!re.success) errores.push(...mensajes(re.error));

    const pilares = Array.isArray(d.pilares) ? d.pilares : [];
    for (const p of pilares) {
      if (!p || typeof p !== 'object' || (p as { estado?: unknown }).estado !== 'ok') continue;
      const subcategorias = (p as { subcategorias?: unknown }).subcategorias;
      if (!Array.isArray(subcategorias)) continue;
      for (const s of subcategorias) {
        const temas = s && typeof s === 'object' ? (s as { temas?: unknown }).temas : undefined;
        if (!Array.isArray(temas)) continue;
        for (const t of temas) {
          const rt = temaGeneradoSchema.safeParse(t);
          if (!rt.success) errores.push(...mensajes(rt.error));
        }
      }
    }

    if (errores.length) return { ok: false, errores };
    return { ok: true };
  }

  // growth
  const r = growthSchema.partial().passthrough().safeParse(datos);
  if (!r.success) return { ok: false, errores: mensajes(r.error) };
  return { ok: true };
}

/** Quién puede entrar en modo edición: admin siempre; operador asignado si la etapa no está en revisión; cliente nunca. */
export function puedeEditar(rol: Rol, esOperadorAsignado: boolean, estado: Estado): boolean {
  if (rol === 'cliente') return false;
  if (rol === 'admin') return true;
  return esOperadorAsignado && estado !== 'en_revision';
}
