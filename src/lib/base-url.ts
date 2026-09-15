/**
 * Origen público del Studio para armar enlaces que salen del sitio (enlace
 * de invitación, link público `/p/`, fix menores M2 punto 4).
 *
 * Por qué no basta `new URL(request.url).origin`: en Railway el proceso
 * recibe la petición del proxy por http y con un host interno, así que ese
 * origen producía enlaces `http://10.x.x.x:8080/...` que no le sirven a quien
 * los recibe. Orden de preferencia:
 * 1. `PUBLIC_BASE_URL`, si está configurada (lo más confiable);
 * 2. si no, lo que el proxy reenvía: `x-forwarded-proto` y `x-forwarded-host`
 *    (primer valor de cada lista, como en `mismoOrigen` de csrf.ts), o la
 *    cabecera `Host`;
 * 3. sin esquema reenviado, `https` en producción (el proxy termina TLS) y el
 *    esquema de la petición fuera de ella (desarrollo en http://localhost).
 */
export function baseUrlPublica(
  request: Request,
  opciones: { publicBaseUrl?: string; produccion?: boolean } = {},
): string {
  const configurada = (('publicBaseUrl' in opciones ? opciones.publicBaseUrl : process.env.PUBLIC_BASE_URL) ?? '').trim();
  if (configurada) return configurada.replace(/\/+$/, '');

  const produccion = opciones.produccion ?? Boolean(import.meta.env?.PROD);
  const url = new URL(request.url);
  const primero = (valor: string | null) => (valor ?? '').split(',')[0]!.trim();

  const host = primero(request.headers.get('x-forwarded-host')) || primero(request.headers.get('host')) || url.host;
  const protoReenviado = primero(request.headers.get('x-forwarded-proto')).toLowerCase();
  const proto = protoReenviado === 'http' || protoReenviado === 'https'
    ? protoReenviado
    : produccion ? 'https' : url.protocol.replace(/:$/, '');

  return `${proto}://${host}`;
}
