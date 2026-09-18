import { describe, it, expect } from 'vitest';
import { tipoReal, mimeGuardable, mimePermitido, extensionDe } from '@/lib/files';
import { rangoPedido, respuestaArchivo, tipoServible } from '@/lib/servir-archivo';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);
const ftyp = (marca: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp' + marca), Buffer.alloc(8)]);

describe('tipoReal: el tipo por el contenido, no por el nombre', () => {
  it('reconoce PNG, JPEG y MP4', () => {
    expect(tipoReal(PNG)).toBe('image/png');
    expect(tipoReal(JPEG)).toBe('image/jpeg');
    expect(tipoReal(ftyp('isom'))).toBe('video/mp4');
    expect(tipoReal(ftyp('mp42'))).toBe('video/mp4');
  });

  it('rechaza un HTML aunque se llame .png, y lo vacío', () => {
    expect(tipoReal(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(tipoReal(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(tipoReal(Buffer.alloc(0))).toBeNull();
  });

  it('HEIC/AVIF usan la misma caja ftyp pero son imágenes: no pasan por video; tampoco el .mov', () => {
    for (const marca of ['heic', 'mif1', 'avif', 'qt  ']) expect(tipoReal(ftyp(marca)), marca).toBeNull();
  });

  it('el MP4 se puede guardar y servir, pero la ficha del cliente sigue sin aceptarlo', () => {
    expect(mimeGuardable('video/mp4')).toBe(true);
    expect(mimePermitido('video/mp4')).toBe(false);
    expect(tipoServible('video/mp4')).toBe('video/mp4');
    expect(tipoServible('text/html')).toBe('application/octet-stream');
  });

  it('la extensión sale del tipo verificado', () => {
    expect(extensionDe('image/jpeg')).toBe('jpg');
    expect(extensionDe('video/mp4')).toBe('mp4');
  });
});

describe('rangos (para que Safari reproduzca el video)', () => {
  it('interpreta un rango simple, uno abierto y el sufijo', () => {
    expect(rangoPedido('bytes=0-9', 100)).toEqual({ inicio: 0, fin: 9 });
    expect(rangoPedido('bytes=90-', 100)).toEqual({ inicio: 90, fin: 99 });
    expect(rangoPedido('bytes=-10', 100)).toEqual({ inicio: 90, fin: 99 });
    expect(rangoPedido('bytes=50-500', 100)).toEqual({ inicio: 50, fin: 99 });
  });

  it('ignora lo que no entiende y marca lo imposible', () => {
    expect(rangoPedido(null, 100)).toBeNull();
    expect(rangoPedido('bytes=0-1,5-6', 100)).toBeNull();
    expect(rangoPedido('items=0-1', 100)).toBeNull();
    expect(rangoPedido('bytes=100-', 100)).toBe('fuera');
  });

  it('respuestaArchivo contesta 206 con el trozo, y 416 fuera de rango', async () => {
    const buf = Buffer.from('0123456789');
    const r = respuestaArchivo(buf, { nombreOriginal: 'v.mp4', mime: 'video/mp4' }, {}, 'bytes=2-4');
    expect(r.status).toBe(206);
    expect(r.headers.get('Content-Range')).toBe('bytes 2-4/10');
    expect(await r.text()).toBe('234');
    expect(r.headers.get('Content-Disposition')).toMatch(/^inline/);
    expect(respuestaArchivo(buf, { nombreOriginal: 'v.mp4', mime: 'video/mp4' }, {}, 'bytes=20-').status).toBe(416);
    expect(respuestaArchivo(buf, { nombreOriginal: 'v.mp4', mime: 'video/mp4' }).status).toBe(200);
  });
});
