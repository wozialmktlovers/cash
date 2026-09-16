import { describe, it, expect } from 'vitest';
import { validarNuevaPieza, validarCambioPieza } from '@/contenido/piezas';

/**
 * El enlace de un arte es el único campo de la pieza que el operador escribe y
 * que acaba en un `href`/`src` del documento que abre el CLIENTE, en el origen
 * del Studio y con su sesión. `z.url()` a secas (zod 4.4.3) no mira el esquema:
 * acepta `javascript:`, `data:`, `vbscript:` y `file:`. Estas pruebas fijan la
 * lista blanca; si alguien vuelve a poner un `z.url()` pelado, fallan.
 */

const PIEZA = { formato: 'reel' as const, plataforma: 'instagram' as const };
const conEnlace = (url: string) => validarNuevaPieza({ ...PIEZA, arte: [{ tipo: 'video', url }] });

const ESQUEMAS_PROHIBIDOS = [
  'javascript:alert(document.domain)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'jav\tascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'mailto:alguien@ejemplo.mx',
];

describe('arte · el enlace solo puede ser web', () => {
  it.each(ESQUEMAS_PROHIBIDOS)('rechaza %j en el alta', (url) => {
    const r = conEnlace(url);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join(' ')).toContain('http://');
  });

  it.each(ESQUEMAS_PROHIBIDOS)('rechaza %j también en la edición', (url) => {
    const r = validarCambioPieza({ arte: [{ tipo: 'video', url }] });
    expect(r.ok).toBe(false);
  });

  it.each([
    'https://videos.ejemplo.mx/reel-3.mp4',
    'http://videos.ejemplo.mx/reel-3.mp4',
    'HTTPS://VIDEOS.EJEMPLO.MX/reel.mp4',
    'https://drive.google.com/file/d/abc/view?usp=sharing',
  ])('deja pasar %j, que es lo que el operador de verdad pega', (url) => {
    const r = conEnlace(url);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.arte[0].url).toBe(url);
  });

  it('el mensaje de error dice qué se espera, no «enlace inválido»', () => {
    const r = conEnlace('javascript:alert(1)');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toContain('El enlace del arte debe empezar con http:// o https://.');
  });

  it('un arte por archivo sigue sin necesitar enlace', () => {
    const r = validarNuevaPieza({ ...PIEZA, arte: [{ tipo: 'video', fileId: '77777777-7777-4777-8777-777777777777' }] });
    expect(r.ok).toBe(true);
  });

  it('el tope de largo sigue en pie sobre un enlace web', () => {
    const r = conEnlace(`https://ejemplo.mx/${'a'.repeat(2100)}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join(' ')).toContain('demasiado largo');
  });
});
