import { escapar } from '@/render/escapar';

export type BotonCorreo = { texto: string; url: string };

export type OpcionesCorreo = {
  titulo: string;
  texto: string;
  boton?: BotonCorreo;
};

/**
 * Arma un HTML de correo sencillo, en línea (sin hoja de estilos externa,
 * para que sobreviva a cualquier cliente de correo) con la marca «Wozial
 * Studio» y un botón rosa opcional. Todo lo que viene de afuera se escapa.
 */
export function plantillaCorreo(o: OpcionesCorreo): { html: string; texto: string } {
  const titulo = escapar(o.titulo);
  const texto = escapar(o.texto);
  const boton = o.boton
    ? `<p style="margin:28px 0 0"><a href="${escapar(o.boton.url)}" style="display:inline-block;background:#B8446B;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:600;font-family:Arial,Helvetica,sans-serif;font-size:14.5px">${escapar(o.boton.texto)}</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="es-MX">
  <body style="margin:0;padding:32px 16px;background:#f4f2f0;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px">
      <tr>
        <td style="padding:36px 32px">
          <p style="margin:0 0 22px;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:#B8446B;font-weight:700">Wozial Studio</p>
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#1a1a1a">${titulo}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a">${texto}</p>
          ${boton}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // La versión de texto no pasa por `escapar`: no hay riesgo de inyección en
  // texto plano y escapado ahí se vería literal («&lt;» en vez de «<»).
  const texto2 = o.boton ? `${o.titulo}\n\n${o.texto}\n\n${o.boton.texto}: ${o.boton.url}` : `${o.titulo}\n\n${o.texto}`;

  return { html, texto: texto2 };
}

export type EnvioCorreo = {
  para: string | string[];
  asunto: string;
  titulo: string;
  texto: string;
  boton?: BotonCorreo;
};

export type ResultadoEnvio = { enviado: boolean; motivo?: 'sin-configurar' | 'error' };

/**
 * Envía por la API HTTP de Resend. Sin llaves configuradas no falla: solo
 * avisa por consola y sigue. Un error de red o una respuesta no-2xx tampoco
 * se propaga, para que nunca rompa la acción que originó el correo.
 */
export async function enviarCorreo(o: EnvioCorreo, fetchImpl: typeof fetch = fetch): Promise<ResultadoEnvio> {
  const apiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;

  if (!apiKey || !remitente) {
    console.info('[correo] omitido: sin configurar');
    return { enviado: false, motivo: 'sin-configurar' };
  }

  const { html, texto } = plantillaCorreo(o);

  try {
    const respuesta = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: remitente, to: o.para, subject: o.asunto, html, text: texto }),
    });
    if (!respuesta.ok) {
      console.info('[correo] error al enviar:', respuesta.status);
      return { enviado: false, motivo: 'error' };
    }
    return { enviado: true };
  } catch (e) {
    console.info('[correo] error al enviar:', e);
    return { enviado: false, motivo: 'error' };
  }
}
