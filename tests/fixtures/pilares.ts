import type { Estrategia, PilarGenerado, MapaPilares, Funcion, Formato } from '@/pilares/schemas';
import { asignarIds, todosLosTemas, mixReal, fueraDeMargen, buscarDuplicados } from '@/pilares/revision';

// Palabras únicas hechas solo de letras: así cada tema comparte a lo más «tema»
// con los demás y la revisión no los ve parecidos.
function palabra(i: number): string {
  let s = '';
  let n = i + 17576; // 26^3: asegura cuatro letras o más
  while (n > 0) { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

const FUNCIONES_CICLO: Funcion[] = ['autoridad', 'conexion', 'autoridad', 'conexion', 'engagement', 'prueba_social', 'venta', 'autoridad', 'conexion', 'venta'];
const FORMATOS_CICLO: Formato[] = ['reel', 'carrusel', 'story'];

export function estrategiaFalsa(): Estrategia {
  return {
    resumen: 'Mapa editorial de prueba para un cliente sintético.',
    ideas: [1, 2, 3].map((i) => ({ titulo: `Idea ${i}`, texto: `Texto de la idea ${i}.` })),
    principios: Array.from({ length: 12 }, (_, i) => ({ titulo: `Principio ${i + 1}`, texto: `Texto del principio ${i + 1}.` })),
    pilares: [1, 2, 3, 4, 5].map((p) => ({
      nombre: `Pilar ${p}`, pregunta: `¿Pregunta del pilar ${p}?`, funcion: `Función ${p}`,
      objetivo: `Objetivo del pilar ${p}.`, frontera: `Frontera del pilar ${p}.`,
      subcategorias: [1, 2, 3].map((s) => ({ nombre: `Subcategoría ${p}.${s}` })),
    })),
    mix: [
      { funcion: 'autoridad', porcentaje: 30, descripcion: 'Explicar y dar criterio.' },
      { funcion: 'conexion', porcentaje: 30, descripcion: 'Escenas reconocibles.' },
      { funcion: 'engagement', porcentaje: 10, descripcion: 'Conversación.' },
      { funcion: 'prueba_social', porcentaje: 10, descripcion: 'Casos reales.' },
      { funcion: 'venta', porcentaje: 20, descripcion: 'Consideración.' },
    ],
    conversion: {
      titulo: 'De la duda a la acción', texto: 'Texto de conversión.',
      pasos: [{ nombre: 'Orientar', texto: 'Paso uno.' }, { nombre: 'Valorar', texto: 'Paso dos.' }, { nombre: 'Acompañar', texto: 'Paso tres.' }],
    },
    reglaEspecial: null,
    supuestos: [],
  };
}

export function pilarFalso(numero: number, estrategia: Estrategia): PilarGenerado {
  return {
    subcategorias: estrategia.pilares[numero - 1].subcategorias.map((sub, s) => ({
      nombre: sub.nombre,
      temas: Array.from({ length: 20 }, (_, t) => {
        const base = ((numero - 1) * 3 + s) * 20 + t;
        return {
          texto: `Tema ${palabra(base * 3)} ${palabra(base * 3 + 1)} ${palabra(base * 3 + 2)}`,
          funcion: FUNCIONES_CICLO[t % FUNCIONES_CICLO.length],
          formato: FORMATOS_CICLO[t % FORMATOS_CICLO.length],
        };
      }),
    })),
  };
}

export function mapaFalso(): MapaPilares {
  const estrategia = estrategiaFalsa();
  const pilares = [1, 2, 3, 4, 5].map((n) => asignarIds(n, pilarFalso(n, estrategia)));
  const temas = todosLosTemas(pilares);
  const real = mixReal(temas);
  return {
    estrategia,
    pilares,
    revision: { duplicadosRestantes: buscarDuplicados(temas), mixReal: real, fueraDeMargen: fueraDeMargen(estrategia.mix, real), reescritos: 0 },
  };
}
