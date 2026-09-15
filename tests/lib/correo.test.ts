import { describe, it, expect, vi, afterEach } from 'vitest';
import { plantillaCorreo, enviarCorreo, configuracionSmtp } from '@/lib/correo';

describe('plantillaCorreo', () => {
  it('escapa el título y el texto', () => {
    const { html } = plantillaCorreo({ titulo: '<b>Hola</b>', texto: 'Con <i>cursiva</i>' });
    expect(html).toContain('&lt;b&gt;Hola&lt;/b&gt;');
    expect(html).toContain('Con &lt;i&gt;cursiva&lt;/i&gt;');
    expect(html).not.toContain('<b>Hola</b>');
    expect(html).not.toContain('<i>cursiva</i>');
  });

  it('incluye la URL y el texto del botón', () => {
    const { html } = plantillaCorreo({
      titulo: 'Título',
      texto: 'Texto',
      boton: { texto: 'Crear mi acceso', url: 'https://wozial.mx/invitacion/abc' },
    });
    expect(html).toContain('https://wozial.mx/invitacion/abc');
    expect(html).toContain('Crear mi acceso');
  });
});

/** Deja el entorno con una configuración de correo completa. */
function configurar(extra: Record<string, string> = {}) {
  vi.stubEnv('CORREO_SMTP_USUARIO', 'avisos@x.mx');
  vi.stubEnv('CORREO_SMTP_PASSWORD', 'clave-de-aplicacion');
  vi.stubEnv('CORREO_REMITENTE', 'Wozial <avisos@x.mx>');
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
}

describe('configuracionSmtp', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('por omisión apunta a Google Workspace con TLS directo', () => {
    configurar();
    expect(configuracionSmtp()).toEqual({
      host: 'smtp.gmail.com', puerto: 465, seguro: true,
      usuario: 'avisos@x.mx', password: 'clave-de-aplicacion', remitente: 'Wozial <avisos@x.mx>',
    });
  });

  it('en el puerto 587 no usa TLS directo (ahí se sube con STARTTLS)', () => {
    configurar({ CORREO_SMTP_PUERTO: '587' });
    expect(configuracionSmtp()).toMatchObject({ puerto: 587, seguro: false });
  });

  it('se puede mudar de proveedor solo con variables', () => {
    configurar({ CORREO_SMTP_HOST: 'mail.otrodominio.com', CORREO_SMTP_PUERTO: '465' });
    expect(configuracionSmtp()).toMatchObject({ host: 'mail.otrodominio.com', puerto: 465, seguro: true });
  });

  it('un puerto que no es número cae en el de siempre en lugar de romper el envío', () => {
    configurar({ CORREO_SMTP_PUERTO: 'ochenta' });
    expect(configuracionSmtp()).toMatchObject({ puerto: 465, seguro: true });
  });

  it('sin usuario, sin contraseña o sin remitente, no hay configuración', () => {
    configurar({ CORREO_SMTP_USUARIO: '' });
    expect(configuracionSmtp()).toBeNull();
    configurar({ CORREO_SMTP_PASSWORD: '' });
    expect(configuracionSmtp()).toBeNull();
    configurar({ CORREO_REMITENTE: '' });
    expect(configuracionSmtp()).toBeNull();
  });
});

describe('enviarCorreo', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('sin configurar no intenta enviar y lo dice', async () => {
    vi.stubEnv('CORREO_SMTP_USUARIO', '');
    vi.stubEnv('CORREO_SMTP_PASSWORD', '');
    vi.stubEnv('CORREO_REMITENTE', '');
    const enviarFalso = vi.fn();

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'Asunto', titulo: 'T', texto: 'X' }, enviarFalso);

    expect(r).toEqual({ enviado: false, motivo: 'sin-configurar' });
    expect(enviarFalso).not.toHaveBeenCalled();
  });

  it('con la contraseña puesta pero sin remitente, tampoco envía', async () => {
    configurar({ CORREO_REMITENTE: '' });
    const enviarFalso = vi.fn();

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'Asunto', titulo: 'T', texto: 'X' }, enviarFalso);

    expect(r).toEqual({ enviado: false, motivo: 'sin-configurar' });
    expect(enviarFalso).not.toHaveBeenCalled();
  });

  it('configurado, manda el mensaje con remitente, asunto y las dos versiones', async () => {
    configurar();
    const enviarFalso = vi.fn().mockResolvedValue({ messageId: '1' });

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'Asunto', titulo: 'T', texto: 'X', boton: { texto: 'Entrar', url: 'https://x.mx/i/abc' } }, enviarFalso);

    expect(r).toEqual({ enviado: true });
    expect(enviarFalso).toHaveBeenCalledTimes(1);
    const mensaje = enviarFalso.mock.calls[0][0];
    expect(mensaje.from).toBe('Wozial <avisos@x.mx>');
    expect(mensaje.to).toBe('a@b.mx');
    expect(mensaje.subject).toBe('Asunto');
    expect(mensaje.html).toContain('https://x.mx/i/abc');
    expect(mensaje.text).toContain('https://x.mx/i/abc');
  });

  it('si el servidor de correo falla, devuelve error sin lanzar', async () => {
    configurar();
    const enviarFalso = vi.fn().mockRejectedValue(new Error('535 credenciales rechazadas'));

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'A', titulo: 'T', texto: 'X' }, enviarFalso);

    expect(r).toEqual({ enviado: false, motivo: 'error' });
  });

  // Sin inyectar nada: usa nodemailer de verdad contra un puerto cerrado de
  // la máquina local. Es la única prueba que ejerce el camino real (crear el
  // transporte y llamarlo), y comprueba lo que más importa de él: que un
  // servidor de correo caído no tumbe la acción que originó el aviso.
  // 127.0.0.1:1 rechaza al instante, sin DNS ni esperas.
  it('con nodemailer real, un servidor inalcanzable no lanza', async () => {
    configurar({ CORREO_SMTP_HOST: '127.0.0.1', CORREO_SMTP_PUERTO: '1' });

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'A', titulo: 'T', texto: 'X' });

    expect(r).toEqual({ enviado: false, motivo: 'error' });
  });

  // Los registros de Railway no son privados: un fallo de autenticación no
  // debe dejar ahí la contraseña de aplicación.
  it('al fallar no escribe la contraseña en los registros', async () => {
    configurar();
    const avisos: unknown[][] = [];
    const espia = vi.spyOn(console, 'info').mockImplementation((...args) => { avisos.push(args); });
    try {
      await enviarCorreo({ para: 'a@b.mx', asunto: 'A', titulo: 'T', texto: 'X' }, vi.fn().mockRejectedValue(new Error('535 rechazado')));
    } finally {
      espia.mockRestore();
    }
    expect(JSON.stringify(avisos)).not.toContain('clave-de-aplicacion');
  });
});
