import { recortarTexto } from '@/lib/extract';

type ClienteCtx = {
  nombre: string; giro: string; producto: string;
  ciudad: string | null; ticket: string | null;
  contacto: string | null; notas: string | null;
};

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

## Enlaces
${enlaces}

## Documentos del cliente
${docs}`;
}
