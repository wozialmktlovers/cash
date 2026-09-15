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

export type MensajeSmtp = { from: string; to: string | string[]; subject: string; html: string; text: string };
export type EnviarSmtp = (mensaje: MensajeSmtp) => Promise<unknown>;

export type ConfiguracionSmtp = {
  host: string;
  puerto: number;
  seguro: boolean;
  usuario: string;
  password: string;
  remitente: string;
};

/** Puerto de TLS directo. En 587 se empieza en claro y se sube con STARTTLS. */
const PUERTO_TLS = 465;

/**
 * Lee la configuración del servidor de correo del entorno. Devuelve `null` si
 * falta lo imprescindible, que es la señal de «no hay correo configurado».
 *
 * `CORREO_SMTP_HOST` y `CORREO_SMTP_PUERTO` traen los valores de Google
 * Workspace por omisión, que es donde viven los buzones hoy; cambiarlos basta
 * para mudar de proveedor sin tocar código.
 */
export function configuracionSmtp(entorno: NodeJS.ProcessEnv = process.env): ConfiguracionSmtp | null {
  const usuario = entorno.CORREO_SMTP_USUARIO?.trim();
  const password = entorno.CORREO_SMTP_PASSWORD;
  const remitente = entorno.CORREO_REMITENTE?.trim();
  if (!usuario || !password || !remitente) return null;

  const puerto = Number(entorno.CORREO_SMTP_PUERTO ?? PUERTO_TLS);
  return {
    host: entorno.CORREO_SMTP_HOST?.trim() || 'smtp.gmail.com',
    puerto: Number.isFinite(puerto) && puerto > 0 ? puerto : PUERTO_TLS,
    seguro: (Number.isFinite(puerto) ? puerto : PUERTO_TLS) === PUERTO_TLS,
    usuario,
    password,
    remitente,
  };
}

/** Se guarda entre envíos: nodemailer reaprovecha la conexión con el servidor. */
let transporteGuardado: { clave: string; enviar: EnviarSmtp } | null = null;

async function transporteDe(c: ConfiguracionSmtp): Promise<EnviarSmtp> {
  const clave = `${c.host}:${c.puerto}:${c.usuario}`;
  if (transporteGuardado?.clave === clave) return transporteGuardado.enviar;

  // Import diferido: así nodemailer no se carga en los arranques y las pruebas
  // donde no se manda ningún correo.
  const { createTransport } = await import('nodemailer');
  const transporte = createTransport({
    host: c.host,
    port: c.puerto,
    secure: c.seguro,
    auth: { user: c.usuario, pass: c.password },
  });
  const enviar: EnviarSmtp = (mensaje) => transporte.sendMail(mensaje);
  transporteGuardado = { clave, enviar };
  return enviar;
}

/**
 * Envía por SMTP con los buzones del propio dominio. Sin configurar no falla:
 * solo avisa por consola y sigue, y quien invitó copia el enlace a mano. Un
 * fallo del servidor tampoco se propaga, para que nunca rompa la acción que
 * originó el correo.
 *
 * Ojo con Google Workspace: la dirección de `CORREO_REMITENTE` tiene que ser
 * la misma de `CORREO_SMTP_USUARIO` (o un alias dado de alta en esa cuenta).
 * Si no, Google reescribe el remitente y el correo sale a nombre de otra
 * dirección.
 */
export async function enviarCorreo(o: EnvioCorreo, enviarImpl?: EnviarSmtp): Promise<ResultadoEnvio> {
  const config = configuracionSmtp();
  if (!config) {
    console.info('[correo] omitido: sin configurar');
    return { enviado: false, motivo: 'sin-configurar' };
  }

  const { html, texto } = plantillaCorreo(o);

  try {
    const enviar = enviarImpl ?? (await transporteDe(config));
    await enviar({ from: config.remitente, to: o.para, subject: o.asunto, html, text: texto });
    return { enviado: true };
  } catch (e) {
    // Sin detalles del mensaje ni de las credenciales: esto va a los registros
    // de Railway, que no son privados.
    console.info('[correo] error al enviar:', e instanceof Error ? e.message : e);
    return { enviado: false, motivo: 'error' };
  }
}
