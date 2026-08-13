const METODOS_INSEGUROS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Verifica que una petición que cambia estado venga del propio sitio.
 *
 * Compara **hosts**, no orígenes completos. El esquema que ve el proceso no es
 * confiable detrás de un proxy que termina TLS: Railway entrega la petición por
 * http aunque el navegador la haya hecho por https. Comparar el esquema ahí
 * rechaza todo formulario legítimo, que es justo lo que hacía la comprobación
 * propia de Astro. El host sí identifica el sitio, y es lo que impide que una
 * página ajena mande peticiones con la cookie del usuario: el navegador pone el
 * Origin de quien la origina y no se puede falsificar desde el cliente.
 */
export function mismoOrigen(request: Request): boolean {
  const origin = request.headers.get('origin');

  // Sin Origin no se puede verificar la procedencia. Los navegadores lo mandan
  // en toda petición que cambia estado, así que se rechaza.
  if (!origin) return false;

  const reenviado = request.headers.get('x-forwarded-host');
  const host = (reenviado ?? request.headers.get('host') ?? '')
    .split(',')[0]!
    .trim()
    .toLowerCase();
  if (!host) return false;

  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

export function requiereVerificacion(metodo: string): boolean {
  return METODOS_INSEGUROS.has(metodo.toUpperCase());
}
