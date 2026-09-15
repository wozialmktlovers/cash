/**
 * Orígenes públicos del Studio para armar enlaces absolutos (fix menores M2,
 * punto 4, y su fix round 1).
 *
 * Hay DOS usos con reglas distintas:
 *
 * - `baseUrlCorreo`/`enlaceCorreo`: lo que viaja en un CORREO (botón de la
 *   invitación, botón de los avisos). Solo sale de `PUBLIC_BASE_URL`, nunca
 *   de cabeceras. Motivo (fix round 1, revisión M2): sin `PUBLIC_BASE_URL`,
 *   una sesión del equipo podía mandar `Origin: https://evil.tld` y
 *   `X-Forwarded-Host: evil.tld` — `mismoOrigen` compara contra esa misma
 *   cabecera, así que el CSRF pasaba — y Resend enviaba, desde el dominio
 *   verificado de Wozial, un «Crear mi acceso» a `https://evil.tld/invitacion/<token real>`.
 *
 * - `baseUrlPublica`: el enlace que se DEVUELVE en JSON o se pinta en la
 *   interfaz para quien ya está dentro del Studio (copiar el link de
 *   invitación o el `/p/`). Aquí sí se acepta, sin `PUBLIC_BASE_URL`, lo que
 *   reenvía el proxy — en Railway el proceso ve `http://10.x.x.x:8080` — pero
 *   validado de forma estricta: si el host o el esquema no tienen buena
 *   forma, se usa el origen de la petición tal cual.
 */

type Entorno = Record<string, string | undefined>;

/** `NODE_ENV === 'production'` (regla del controlador para decidir si un correo sin `PUBLIC_BASE_URL` se manda). */
export function esProduccion(entorno: Entorno = process.env): boolean {
  return entorno.NODE_ENV === 'production';
}

const HOST_RE = /^[a-z0-9.-]+(:\d+)?$/;

/**
 * Host con forma segura para meterlo en una URL: nombre o IPv4 en minúsculas
 * y puerto numérico opcional. Nada de ruta, consulta, fragmento, credenciales
 * (`u@host`) ni espacios. Quien llama normaliza a minúsculas antes.
 */
export function hostValido(host: string): boolean {
  return HOST_RE.test(host);
}

/**
 * Base para enlaces que van en un correo: `PUBLIC_BASE_URL` sin diagonal
 * final, o `null` si falta, está vacía o no es una URL http(s). Nunca mira
 * la petición.
 */
export function baseUrlCorreo(opciones: { publicBaseUrl?: string } = {}): string | null {
  const configurada = (('publicBaseUrl' in opciones ? opciones.publicBaseUrl : process.env.PUBLIC_BASE_URL) ?? '').trim();
  if (!configurada) return null;
  try {
    const u = new URL(configurada);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return configurada.replace(/\/+$/, '');
}

export type EnlaceCorreo =
  | { modo: 'con-enlace'; url: string }
  /** Fuera de producción sin `PUBLIC_BASE_URL`: se manda el correo, pero sin botón. */
  | { modo: 'sin-enlace' }
  /** En producción sin `PUBLIC_BASE_URL`: el correo no se manda. */
  | { modo: 'no-enviar' };

/**
 * Qué hacer con el enlace de un correo a `ruta` (ruta interna que empieza
 * con `/`). En producción, sin `PUBLIC_BASE_URL`, mejor no mandar nada que
 * mandar un correo al que le falta justo lo que el destinatario necesita (y
 * la configuración queda evidente). En desarrollo se manda sin botón.
 */
export function enlaceCorreo(
  ruta: string,
  opciones: { publicBaseUrl?: string; produccion?: boolean } = {},
): EnlaceCorreo {
  const base = baseUrlCorreo('publicBaseUrl' in opciones ? { publicBaseUrl: opciones.publicBaseUrl } : {});
  if (base) return { modo: 'con-enlace', url: `${base}${ruta}` };
  return (opciones.produccion ?? esProduccion()) ? { modo: 'no-enviar' } : { modo: 'sin-enlace' };
}

/**
 * Origen para el enlace que se muestra dentro del Studio (JSON de la API o
 * HTML de la vista interna). Orden:
 * 1. `PUBLIC_BASE_URL`, si está configurada;
 * 2. si no, `x-forwarded-host` (primer valor) o `Host`, en minúsculas, y el
 *    esquema de `x-forwarded-proto` (primer valor); sin esquema reenviado,
 *    `https` en producción (el proxy termina TLS) y el de la petición fuera;
 * 3. si el host no pasa `hostValido` o el esquema reenviado no es http/https,
 *    el origen de la petición (`new URL(request.url).origin`).
 * NUNCA usar esto para un enlace que se mande por correo: ver `enlaceCorreo`.
 */
export function baseUrlPublica(
  request: Request,
  opciones: { publicBaseUrl?: string; produccion?: boolean } = {},
): string {
  const configurada = baseUrlCorreo('publicBaseUrl' in opciones ? { publicBaseUrl: opciones.publicBaseUrl } : {});
  if (configurada) return configurada;

  const produccion = opciones.produccion ?? esProduccion();
  const url = new URL(request.url);
  const primero = (valor: string | null) => (valor ?? '').split(',')[0]!.trim();

  const host = (primero(request.headers.get('x-forwarded-host')) || primero(request.headers.get('host')) || url.host).toLowerCase();
  if (!hostValido(host)) return url.origin;

  const protoReenviado = primero(request.headers.get('x-forwarded-proto')).toLowerCase();
  if (protoReenviado && protoReenviado !== 'http' && protoReenviado !== 'https') return url.origin;
  const proto = protoReenviado || (produccion ? 'https' : url.protocol.replace(/:$/, ''));

  return `${proto}://${host}`;
}
