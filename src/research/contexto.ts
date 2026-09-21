import { recortarTexto } from '@/lib/extract';

type ClienteCtx = {
  nombre: string; giro: string; producto: string;
  ciudad: string | null; ticket: string | null;
  contacto: string | null; notas: string | null;
  objetivos?: string | null;
};

/**
 * Los objetivos y líneas de investigación que el equipo escribió para este
 * cliente, como sección propia y destacada. Vacía si no hay texto: un
 * encabezado sin nada debajo haría creer al modelo que falta algo.
 *
 * Va antes de enlaces y documentos para que el modelo la lea como marco de
 * todo lo demás. La comparten todos los contextos que llevan datos del
 * cliente (investigación, pilares, mes, propuestas de copy y manual de
 * campaña), así que la instrucción nombra los dos campos donde se declaran
 * huecos: `pendientes` en la investigación y `bloqueantes` en el manual.
 */
export function seccionObjetivos(objetivos: string | null | undefined): string {
  const texto = objetivos?.trim();
  if (!texto) return '';
  return `## Objetivos y líneas de investigación (prioridad del cliente)
Indicaciones del equipo para este cliente. Mandan sobre tus suposiciones por defecto: si chocan con un criterio general, sigue estas. Cubre cada punto que pidan investigar o considerar. Si alguno no se pudo responder con lo que encontraste, dilo en pendientes (o en bloqueantes, si tu respuesta no tiene pendientes) en vez de callarlo o inventarlo.

${texto}

`;
}

export function armarContexto(
  c: ClienteCtx,
  links: { tipo: string; url: string }[],
  archivos: { nombreOriginal: string; textoExtraido: string | null }[]
): string {
  const enlaces = links.length
    ? links.map((l) => `- ${l.tipo}: ${l.url}`).join('\n')
    : 'Sin enlaces registrados.';

  const conTexto = archivos.filter((a) => a.textoExtraido);
  const docs = conTexto.length
    ? conTexto.map((a) => `### ${a.nombreOriginal}\n${recortarTexto(a.textoExtraido!)}`).join('\n\n')
    : 'Sin archivos con texto extraído.';

  return `## Cliente
Nombre: ${c.nombre}
Giro: ${c.giro}
Producto o servicio: ${c.producto}
Ciudad: ${c.ciudad ?? 'no especificada'}
Ticket: ${c.ticket ?? 'no especificado'}
Notas del operador: ${c.notas ?? 'ninguna'}

${seccionObjetivos(c.objetivos)}## Enlaces
${enlaces}

## Documentos del cliente
${docs}`;
}
