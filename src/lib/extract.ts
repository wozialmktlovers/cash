export const LIMITE_TEXTO = 40_000;

export function recortarTexto(texto: string, limite = LIMITE_TEXTO): string {
  if (texto.length <= limite) return texto;

  const tamInicio = Math.floor(limite * 0.75);
  const tamFinal = limite - tamInicio;
  const omitidos = texto.length - tamInicio - tamFinal;

  const inicio = texto.slice(0, tamInicio);
  const final = texto.slice(-tamFinal);

  return `${inicio}\n\n[recorte] se omitieron ${omitidos} caracteres del centro\n\n${final}`;
}

export async function extraerTexto(
  buf: Buffer, mime: string
): Promise<{ texto: string | null; estado: 'ok' | 'fallo' | 'no_aplica' }> {
  try {
    if (mime === 'text/plain') {
      return { texto: buf.toString('utf8'), estado: 'ok' };
    }
    if (mime === 'application/pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const doc = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(doc, { mergePages: true });
      return { texto: text, estado: 'ok' };
    }
    if (mime.includes('wordprocessingml')) {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { texto: value, estado: 'ok' };
    }
    if (mime.startsWith('image/')) {
      return { texto: null, estado: 'no_aplica' };
    }
    return { texto: null, estado: 'fallo' };
  } catch {
    return { texto: null, estado: 'fallo' };
  }
}
