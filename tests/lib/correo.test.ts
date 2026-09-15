import { describe, it, expect, vi, afterEach } from 'vitest';
import { plantillaCorreo, enviarCorreo } from '@/lib/correo';

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

describe('enviarCorreo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sin RESEND_API_KEY no llama al fetch y devuelve sin-configurar', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('CORREO_REMITENTE', '');
    const fetchFalso = vi.fn();

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'Asunto', titulo: 'T', texto: 'X' }, fetchFalso);

    expect(r).toEqual({ enviado: false, motivo: 'sin-configurar' });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('sin CORREO_REMITENTE tampoco llama al fetch', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k');
    vi.stubEnv('CORREO_REMITENTE', '');
    const fetchFalso = vi.fn();

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'Asunto', titulo: 'T', texto: 'X' }, fetchFalso);

    expect(r).toEqual({ enviado: false, motivo: 'sin-configurar' });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('con las llaves configuradas llama a Resend con el cuerpo esperado', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k');
    vi.stubEnv('CORREO_REMITENTE', 'Wozial <hola@x.mx>');
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'Asunto', titulo: 'T', texto: 'X' }, fetchFalso);

    expect(r).toEqual({ enviado: true });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer k');
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.from).toBe('Wozial <hola@x.mx>');
    expect(cuerpo.to).toBe('a@b.mx');
    expect(cuerpo.subject).toBe('Asunto');
    expect(typeof cuerpo.html).toBe('string');
    expect(typeof cuerpo.text).toBe('string');
  });

  it('si el fetch lanza, devuelve error sin lanzar', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k');
    vi.stubEnv('CORREO_REMITENTE', 'Wozial <hola@x.mx>');
    const fetchFalso = vi.fn().mockRejectedValue(new Error('red caída'));

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'A', titulo: 'T', texto: 'X' }, fetchFalso);

    expect(r).toEqual({ enviado: false, motivo: 'error' });
  });

  it('si el fetch responde 500, devuelve error sin lanzar', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k');
    vi.stubEnv('CORREO_REMITENTE', 'Wozial <hola@x.mx>');
    const fetchFalso = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const r = await enviarCorreo({ para: 'a@b.mx', asunto: 'A', titulo: 'T', texto: 'X' }, fetchFalso);

    expect(r).toEqual({ enviado: false, motivo: 'error' });
  });
});
