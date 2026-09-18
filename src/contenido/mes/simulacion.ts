// Modo de prueba del agente del mes: una respuesta inventada en vez de la API.
//
// Existe para poder probar la pantalla, el trabajo en segundo plano y el
// guardado de punta a punta sin gastar saldo. Solo se activa con las dos
// condiciones a la vez:
//
// - `import.meta.env.DEV`: Vite lo reemplaza por `false` al compilar para
//   producción, así que en `astro build` esta rama desaparece del paquete y no
//   hay variable de entorno que la reviva;
// - `CONTENIDO_MES_SIMULADO=1` en el entorno del servidor de desarrollo.
//
// La respuesta imita a propósito las variantes que el normalizador tiene que
// aguantar —llaves con acento, «Reel» con mayúscula, fechas en `DD/MM/AAAA`,
// hashtags en texto—, para que el modo de prueba ejerza también ese camino.

import type { EntradaTanda } from './agente';

export function simulacionActiva(): boolean {
  return import.meta.env.DEV === true && process.env.CONTENIDO_MES_SIMULADO === '1';
}

const FORMATO_ESCRITO = { post: 'Imagen estática', carrusel: 'Carrusel 4:5', reel: 'Reel', historia: 'Story' } as const;

export function respuestaSimulada(t: EntradaTanda): unknown {
  return {
    resultado: {
      piezas: t.ranuras.map((r, i) => {
        const tema = t.candidatos.get(r.ref)?.[0];
        const idea = tema?.texto ?? 'Una idea de la estrategia del mes';
        const [a, m, d] = r.fecha.split('-');
        return {
          ranura: r.ref,
          'Tema': tema?.id ?? null,
          formato: FORMATO_ESCRITO[r.formato],
          'fecha de publicación': `${d}/${m}/${a}`,
          plataforma: i % 3 === 0 ? 'Facebook e Instagram' : i % 3 === 1 ? 'Instagram' : 'FB',
          copy: `[Simulación] ${idea}.\n\nTexto de prueba generado sin llamar al modelo: aquí iría el copy de la pieza ${r.ref}, escrito para ${r.formato} y para la función «${r.funcion}».`,
          'llamado a la acción': 'Escríbenos por mensaje directo.',
          hashtags: '#simulacion #contenido prueba #wozialstudio #mes',
          'brief visual': `Encuadre cerrado sobre la escena de «${idea}». Texto en pantalla: la primera línea del copy.`,
          'prompt de imagen': `Fotografía editorial, luz natural suave, encuadre medio, escena cotidiana que ilustra: ${idea}. Paleta cálida, sin texto ni logotipos.`,
          'guión': r.formato === 'reel'
            ? [
                { 'lo que se ve': 'Plano cerrado de manos en acción.', 'lo que se dice': 'La pregunta que abre el video.' },
                { 'lo que se ve': 'Plano abierto del lugar.', 'lo que se dice': 'El giro de la historia.' },
                'Cierre con el llamado a la acción en pantalla.',
              ]
            : [],
          'láminas': r.formato === 'carrusel' ? ['El gancho de la primera lámina', 'La idea en un paso', 'El segundo paso', 'Lo que puedes hacer hoy'] : [],
        };
      }),
    },
  };
}
