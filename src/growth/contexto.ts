import type { Investigacion } from '@/research/schemas';

type ClienteCtx = {
  nombre: string; giro: string; producto: string;
  ciudad: string | null; ticket: string | null; notas: string | null;
};

/** Nombre legible de cada etapa, para poder declarar los huecos por su nombre. */
const NOMBRES: Record<string, string> = {
  competencia: 'Competencia',
  audiencia: 'Audiencia',
  canales: 'Canales',
  mercado: 'Mercado',
  sintesis: 'Síntesis estratégica',
};

/**
 * Contexto del manual de campaña: la investigación ya hecha, no la ficha cruda
 * del cliente.
 *
 * Es la diferencia que abarata el Growth. Los agentes de campaña razonan sobre
 * datos que ya se buscaron y vienen con fuente, en vez de volver a salir a la
 * web a averiguar lo mismo.
 *
 * Las etapas vacías se declaran con su razón. Callarlas sería peor que no
 * tenerlas: el modelo rellenaría el hueco inventando, y el manual saldría
 * apoyado en competencia o audiencia que nadie investigó.
 */
export function armarContextoGrowth(inv: Investigacion, c: ClienteCtx): string {
  const bloques: string[] = [];
  const faltantes: string[] = [];

  for (const [clave, nombre] of Object.entries(NOMBRES)) {
    const etapa = (inv as any)[clave];
    if (etapa?.estado === 'ok') {
      bloques.push(`### ${nombre}\n${JSON.stringify(etapa.datos, null, 2)}`);
    } else {
      faltantes.push(`- ${nombre}: ${etapa?.razon ?? 'no produjo datos.'}`);
    }
  }

  const aviso = faltantes.length
    ? `\n\n## Etapas sin datos\nEstas etapas de la investigación no produjeron resultados:\n${faltantes.join('\n')}\n\nNo inventes su contenido. Ajusta la campaña a lo que sí hay y deja constancia en los bloqueantes de lo que hace falta averiguar antes de invertir.`
    : '';

  return `## Cliente
Nombre: ${c.nombre}
Giro: ${c.giro}
Producto: ${c.producto}
Ciudad: ${c.ciudad ?? 'no declarada'}
Ticket: ${c.ticket ?? 'no declarado'}
Notas: ${c.notas ?? 'sin notas'}

## Investigación previa
${bloques.length ? bloques.join('\n\n') : 'La investigación no produjo ninguna etapa con datos.'}${aviso}`;
}

/** Reglas comunes a los cuatro agentes de campaña. */
export const SISTEMA_GROWTH = `Eres estratega de medios de pago para una agencia mexicana. Recibes una investigación de mercado ya hecha y devuelves JSON.

Reglas que no se rompen:
- No busques en la web. Todo lo que necesitas está en la investigación que se te entrega; si un dato no está ahí, no existe para este manual.
- No inventes cifras, precios ni fuentes. Si la investigación no lo trae, dilo en los bloqueantes en vez de rellenar.
- La estructura es fija y no la decides tú: tres campañas en Meta con grupos a, b y c; cinco en Google con las claves marca, categoria, precio, geo y contenido; nueve creativos, uno por cada combinación de grupo y formato.
- Escribe en español de México, en segunda persona y sin promesas de ingresos.
- Responde solo con JSON válido, sin texto antes ni después.`;
