// Qué se escribe en la base al terminar de generar el mes. Puro: recibe las
// piezas del lote tal como están AL MOMENTO DE GUARDAR y lo que escribió el
// modelo, y devuelve qué borrar, qué dar de alta y qué temas marcar. La
// escritura la hace el pipeline (./pipeline.ts) en una sola transacción.
//
// La regla que más importa vive aquí y no en la pantalla: **ninguna pieza
// aprobada ni con cambios pedidos se borra nunca, y una con arte solo si quien
// lanzó la generación lo confirmó**. Se vuelve a comprobar con las piezas
// frescas, no con las que había cuando se lanzó el trabajo: el cliente pudo
// aprobar una pieza, o el operador subirle arte, mientras la IA escribía.

import { LIMITES_PIEZA, type Escena, type Formato, type Plataforma } from '../reglas';
import { recortar } from '@/research/normalizar';
import { diaDeLaSemana, esHabil, esReemplazable, numerosLibres, type Modo, type PiezaExistente, type Ranura } from './plan';
import type { PiezaMes } from './schemas';

/** Proporción del arte según el formato. No la elige el modelo: la dicta el formato (lección de 87ea948). */
export const RATIO_POR_FORMATO: Record<Formato, { ratio: string; texto: string }> = {
  post: { ratio: '4x5', texto: 'Formato vertical 4:5 (1080 × 1350 px).' },
  carrusel: { ratio: '4x5', texto: 'Formato vertical 4:5 (1080 × 1350 px), una imagen por lámina.' },
  reel: { ratio: '9x16', texto: 'Formato vertical 9:16 (1080 × 1920 px).' },
  historia: { ratio: '9x16', texto: 'Formato vertical 9:16 (1080 × 1920 px).' },
};

/** El prompt de imagen con su proporción al final, si el modelo no la dijo. */
export function promptConProporcion(prompt: string, formato: Formato): string {
  if (!prompt) return '';
  if (/\d{1,2}\s*[:x×]\s*\d{1,2}/.test(prompt)) return prompt;
  const sufijo = RATIO_POR_FORMATO[formato].texto;
  return `${recortar(prompt, LIMITES_PIEZA.promptImagen - sufijo.length - 1)} ${sufijo}`;
}

/** Una pieza que el modelo escribió para una ranura, ya con su tema resuelto. */
export type PiezaGenerada = { ranura: Ranura; pieza: PiezaMes; temaId: string | null };

/** La fila que se da de alta en `contenido_piezas`. */
export type Alta = {
  numero: number;
  formato: Formato;
  plataforma: Plataforma;
  fechaPublicacion: string;
  temaId: string | null;
  copy: string;
  cta: string;
  hashtags: string;
  briefVisual: string;
  promptImagen: string;
  guion: Escena[];
  tarjetas: string[];
};

/**
 * La fecha con que se queda la pieza: la del plan, salvo que el modelo haya
 * propuesto otra que sea un día hábil a dos días o menos y que no tenga ya
 * otra pieza nueva. Así puede acomodar una pieza al día que le va mejor sin
 * deshacer el reparto.
 */
export function elegirFecha(plan: string, propuesta: string | null, tomadas: Set<string>): string {
  if (!propuesta || propuesta === plan || !esHabil(propuesta) || tomadas.has(propuesta)) return plan;
  const dias = Math.abs(Date.parse(`${propuesta}T00:00:00Z`) - Date.parse(`${plan}T00:00:00Z`)) / 86_400_000;
  return dias <= 2 && diaDeLaSemana(propuesta) !== 0 ? propuesta : plan;
}

/** Las altas del mes, en orden de fecha, con los números libres del lote. */
export function armarAltas(generadas: PiezaGenerada[], numerosOcupados: number[]): Alta[] {
  const tomadas = new Set(generadas.map((g) => g.ranura.fecha));
  const conFecha = generadas.map((g) => {
    const fecha = elegirFecha(g.ranura.fecha, g.pieza.fecha, tomadas);
    tomadas.add(fecha);
    return { g, fecha };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.g.ranura.ref - b.g.ranura.ref);

  const numeros = numerosLibres(numerosOcupados, conFecha.length);
  return conFecha.map(({ g, fecha }, i) => {
    const f = g.ranura.formato;
    return {
      numero: numeros[i],
      formato: f,
      plataforma: g.pieza.plataforma,
      fechaPublicacion: fecha,
      temaId: g.temaId,
      copy: g.pieza.copy,
      cta: g.pieza.cta,
      hashtags: g.pieza.hashtags,
      briefVisual: g.pieza.briefVisual,
      promptImagen: promptConProporcion(g.pieza.promptImagen, f),
      // Cada formato lleva lo suyo y nada más: un guion en un post confundiría
      // a quien produce la pieza.
      guion: f === 'reel' ? g.pieza.guion : [],
      tarjetas: f === 'carrusel' ? g.pieza.tarjetas : [],
    };
  });
}

export type Guardado = {
  /** Ids de las piezas que se borran (solo en `reemplazar`). */
  borrar: string[];
  altas: Alta[];
  /** Temas que pasan a «En desarrollo» en el banco de pilares. */
  temas: string[];
};

/**
 * La decisión completa. `reemplazar` borra solo las piezas que eran
 * reemplazables cuando se lanzó el trabajo (`planeadas`) Y lo siguen siendo
 * ahora; `completar` no borra nada.
 */
export function decidirGuardado(o: {
  modo: Modo;
  incluirConArte: boolean;
  actuales: PiezaExistente[];
  planeadas: string[];
  generadas: PiezaGenerada[];
}): Guardado {
  const planeadas = new Set(o.planeadas);
  const borrar = o.modo === 'reemplazar'
    ? o.actuales.filter((p) => planeadas.has(p.id) && esReemplazable(p, o.incluirConArte)).map((p) => p.id)
    : [];
  const seBorran = new Set(borrar);
  const ocupados = o.actuales.filter((p) => !seBorran.has(p.id)).map((p) => p.numero);
  const altas = armarAltas(o.generadas, ocupados);
  const temas = [...new Set(altas.map((a) => a.temaId).filter((t): t is string => !!t))];
  return { borrar, altas, temas };
}
