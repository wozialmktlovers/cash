import { z } from 'zod';
import { normalizarTema } from './texto';

export const FUNCIONES = ['autoridad', 'conexion', 'engagement', 'prueba_social', 'venta'] as const;
export const FORMATOS = ['reel', 'carrusel', 'story'] as const;
export const ESTADOS_TEMA = ['pendiente', 'en_desarrollo', 'desarrollado', 'publicado'] as const;
export type Funcion = (typeof FUNCIONES)[number];
export type Formato = (typeof FORMATOS)[number];
export type EstadoTema = (typeof ESTADOS_TEMA)[number];

const texto = (max: number) => z.string().min(1).max(max);

export const estrategiaSchema = z.object({
  resumen: texto(240),
  ideas: z.array(z.object({ titulo: texto(80), texto: texto(320) })).length(3),
  principios: z.array(z.object({ titulo: texto(80), texto: texto(220) })).length(12),
  pilares: z.array(z.object({
    nombre: texto(50),
    pregunta: texto(160),
    funcion: texto(120),
    objetivo: texto(320),
    frontera: texto(220),
    subcategorias: z.array(z.object({ nombre: texto(70) })).length(3),
  })).length(5),
  mix: z.array(z.object({
    funcion: z.enum(FUNCIONES),
    porcentaje: z.number().int().min(0).max(100),
    descripcion: texto(140),
  })).length(5),
  conversion: z.object({
    titulo: texto(90),
    texto: texto(320),
    pasos: z.array(z.object({ nombre: texto(30), texto: texto(180) })).length(3),
  }),
  reglaEspecial: texto(400).nullable(),
  supuestos: z.array(texto(200)).max(5),
}).superRefine((e, ctx) => {
  const suma = e.mix.reduce((s, m) => s + m.porcentaje, 0);
  if (suma !== 100) ctx.addIssue({ code: 'custom', message: `Los porcentajes del mix suman ${suma}; deben sumar 100.` });
  if (new Set(e.mix.map((m) => m.funcion)).size !== FUNCIONES.length) {
    ctx.addIssue({ code: 'custom', message: 'El mix debe tener exactamente una entrada por función.' });
  }
});
export type Estrategia = z.infer<typeof estrategiaSchema>;

export const temaGeneradoSchema = z.object({
  texto: texto(160),
  funcion: z.enum(FUNCIONES),
  formato: z.enum(FORMATOS),
});
export type TemaGenerado = z.infer<typeof temaGeneradoSchema>;

// Mismo normalizador que usa `revision.ts` para detectar duplicados entre pilares.
const claveTexto = normalizarTema;

/** Esquema de un pilar atado a las subcategorías que definió la estrategia. */
export function pilarSchemaPara(nombres: string[]) {
  return z.object({
    subcategorias: z.array(z.object({
      nombre: texto(70),
      temas: z.array(temaGeneradoSchema).length(20),
    })).length(3),
  }).superRefine((p, ctx) => {
    p.subcategorias.forEach((s, i) => {
      if (claveTexto(s.nombre) !== claveTexto(nombres[i] ?? '')) {
        ctx.addIssue({ code: 'custom', message: `La subcategoría ${i + 1} debe llamarse «${nombres[i]}».` });
      }
    });
    const vistos = new Set<string>();
    for (const s of p.subcategorias) for (const t of s.temas) {
      const k = claveTexto(t.texto);
      if (vistos.has(k)) ctx.addIssue({ code: 'custom', message: `Tema repetido: «${t.texto}».` });
      vistos.add(k);
    }
  });
}
export type PilarGenerado = { subcategorias: { nombre: string; temas: TemaGenerado[] }[] };

export const reemplazosSchema = z.object({
  // El número de tema va de 01 a 20: nada de 00 ni de 21 en adelante.
  temas: z.array(z.object({ id: z.string().regex(/^P[1-5]-S[1-3]-(0[1-9]|1\d|20)$/), ...temaGeneradoSchema.shape })),
});

export type Tema = TemaGenerado & { id: string };
export type PilarMapa =
  | { numero: number; estado: 'ok'; subcategorias: { nombre: string; temas: Tema[] }[] }
  | { numero: number; estado: 'vacio'; razon: string };
export type Revision = {
  duplicadosRestantes: [string, string][];
  mixReal: Record<Funcion, number>;
  fueraDeMargen: Funcion[];
  reescritos: number;
};
export type MapaPilares = { estrategia: Estrategia; pilares: PilarMapa[]; revision: Revision };
