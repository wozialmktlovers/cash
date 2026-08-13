import { describe, it, expect } from 'vitest';
import { mimePermitido, rutaSegura } from '@/lib/files';

describe('files', () => {
  it('permite PDF, DOCX, TXT, PNG y JPEG', () => {
    for (const m of ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg']) {
      expect(mimePermitido(m)).toBe(true);
    }
  });

  it('rechaza ejecutables y HTML', () => {
    expect(mimePermitido('application/x-msdownload')).toBe(false);
    expect(mimePermitido('text/html')).toBe(false);
  });

  it('bloquea escape de directorio', () => {
    expect(() => rutaSegura('/data', '../../etc/passwd')).toThrow();
  });

  it('resuelve una ruta legítima dentro del directorio', () => {
    expect(rutaSegura('/data', 'abc/archivo.pdf')).toBe('/data/abc/archivo.pdf');
  });
});
