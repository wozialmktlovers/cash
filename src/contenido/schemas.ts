// Esquemas de las propuestas de copy de una pieza (diseño §5, tarea B2).
//
// El agente devuelve **tres opciones** para una misma pieza y el operador
// elige una, la edita y la guarda. Los tres números que gobiernan todo esto
// —cuántas opciones, cuánto mide cada campo y cuántos hashtags— viven en
// `OPCIONES` y `LIMITES`, y de ahí los leen tanto este esquema como el texto
// del prompt (`agentes.ts`) y las pruebas. Si el límite de caracteres de una
// red cambia, se cambia aquí y el prompt se entera solo.
//
// Los topes no son decorativos: `copy` a 2200 es el máximo que Instagram
// acepta en el pie de una publicación, y un copy que la red recorta llega
// mutilado al cliente. `gancho` a 120 es la primera línea, la que se lee
// antes del «ver más». El `briefVisual` a 400 es la indicación para quien
// haga el arte, no un guion: si no cabe en un párrafo, no es un brief.
//
// Mismo idioma que `src/pilares/schemas.ts`, y a propósito: el esquema es el
// contrato con el modelo, y `pedirJson` le devuelve sus errores tal cual para
// que corrija en el segundo intento. Por eso los mensajes están escritos para
// que los lea el modelo, no solo para que los lea una persona.

import { z } from 'zod';
import { normalizarTema } from '@/pilares/texto';
import type { Funcion, Formato as FormatoTema } from '@/pilares/schemas';
import { PLATAFORMAS, type Formato, type Plataforma } from './reglas';

/** Cuántas opciones devuelve el agente por pieza. Ni una menos, ni una más: son para elegir. */
export const OPCIONES = 3;

/**
 * Los largos de cada campo, en caracteres, y el rango de hashtags.
 * `copy` es el máximo de Instagram; el resto son decisiones editoriales.
 */
export const LIMITES = {
  gancho: 120,
  copy: 2200,
  cta: 120,
  briefVisual: 400,
  hashtagsMin: 5,
  hashtagsMax: 10,
} as const;

const texto = (max: number) => z.string().min(1).max(max);

/**
 * Un hashtag es una sola palabra. Se normaliza antes de validar —se le quita
 * el espacio de sobra y las almohadillas repetidas, y se le pone una— porque
 * el modelo tanto escribe `#salud` como `salud`, y las dos cosas significan
 * lo mismo: rechazar la respuesta entera por eso sería cobrar una segunda
 * llamada para arreglar una almohadilla. Lo que sí se rechaza es lo que no se
 * puede publicar tal cual: dos palabras con espacio en medio, signos, acentos
 * sueltos. Instagram no los admite y el operador tendría que corregirlos a mano.
 */
const HASHTAG_RE = /^#[\p{L}\p{N}_]{2,60}$/u;

export const hashtagSchema = z.string()
  .transform((h) => `#${h.trim().replace(/^#+/, '').trim()}`)
  .refine((h) => HASHTAG_RE.test(h), 'Cada hashtag es una sola palabra sin espacios ni signos, con o sin #: «#tequisquiapan».');

/**
 * Una de las tres opciones. `briefVisual` es lo único que no se publica: es la
 * indicación para quien haga el arte (diseño §8, el Studio no genera imágenes).
 */
export const opcionCopySchema = z.object({
  gancho: texto(LIMITES.gancho),
  copy: texto(LIMITES.copy),
  cta: texto(LIMITES.cta),
  hashtags: z.array(hashtagSchema).min(LIMITES.hashtagsMin).max(LIMITES.hashtagsMax),
  briefVisual: texto(LIMITES.briefVisual),
}).superRefine((o, ctx) => {
  // Se comprueba después de normalizar, que es cuando `#Salud` y `salud` ya se
  // ven iguales. Importa porque el mínimo de 5 es de hashtags útiles: con
  // repetidos, una lista de 5 puede ser en realidad una de 3.
  const vistos = new Set<string>();
  for (const h of o.hashtags) {
    const clave = h.toLowerCase();
    if (vistos.has(clave)) ctx.addIssue({ code: 'custom', message: `Hashtag repetido: «${h}».` });
    vistos.add(clave);
  }
});
export type OpcionCopy = z.infer<typeof opcionCopySchema>;

/**
 * La respuesta completa del agente.
 *
 * Exactamente tres opciones, y con ganchos distintos entre sí. Lo segundo no
 * es un adorno del esquema: tres opciones existen para que el operador elija,
 * y tres variaciones de la misma frase no son una elección. Se comparan con el
 * mismo normalizador que usa el mapa de pilares para cazar temas repetidos, así
 * que cambiar mayúsculas, acentos o un signo no basta para colar el mismo gancho
 * dos veces.
 */
export const propuestasCopySchema = z.object({
  opciones: z.array(opcionCopySchema).length(OPCIONES),
}).superRefine((p, ctx) => {
  const vistos = new Set<string>();
  p.opciones.forEach((o, i) => {
    const clave = normalizarTema(o.gancho);
    if (vistos.has(clave)) {
      ctx.addIssue({ code: 'custom', message: `La opción ${i + 1} repite el gancho de otra. Las tres deben atacar el tema por caminos distintos.` });
    }
    vistos.add(clave);
  });
});
export type PropuestasCopy = z.infer<typeof propuestasCopySchema>;

/**
 * Plataformas de una pieza, espejo del enum `plataforma_pieza` de
 * `src/db/schema.ts`. Se declara aquí, y no se importa de `@/db`, para que
 * este módulo siga sin tocar la base: lo importan el prompt y la ruta, y
 * ninguno de los dos debería arrastrar el cliente de Postgres.
 */

/**
 * El tema del mapa de pilares tal como lo necesita el redactor: su texto, la
 * función que cumple en el mix y el formato que la estrategia sugirió para él.
 * Es un tipo propio y no `Tema` de `@/pilares/schemas` para dejar claro que lo
 * que entra al prompt es esto y nada más.
 */
export type TemaParaCopy = { id: string; texto: string; funcion: Funcion; formato: FormatoTema };

/** Lo que el agente necesita saber de la pieza que va a escribir. */
export type PiezaParaCopy = {
  formato: Formato;
  plataforma: Plataforma;
  fechaPublicacion?: string | null;
};

/**
 * Lo que devuelve `generarPropuestas`: las opciones y la cuenta de lo que
 * costó pedirlas. El costo sube hasta la ruta a propósito —la pieza se genera
 * de una en una y cada petición tiene su propio tope (diseño §5)—, para que
 * quien la pidió vea lo que gastó en vez de que se pierda en un log.
 */
export type ResultadoPropuestas = {
  opciones: OpcionCopy[];
  tokensEntrada: number;
  tokensSalida: number;
  costoUsd: number;
  topeUsd: number;
  /** El tope se alcanzó durante esta petición: las opciones sirven, pero la siguiente conviene mirarla. */
  topeAlcanzado: boolean;
};
