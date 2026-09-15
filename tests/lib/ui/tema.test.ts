import { describe, it, expect } from 'vitest';
import { resolverTema, SCRIPT_TEMA, CLAVE_TEMA, COLOR_BARRA } from '@/lib/ui/tema';

describe('resolverTema', () => {
  it('la elección guardada gana al dispositivo', () => {
    expect(resolverTema('claro', true)).toBe('claro');
    expect(resolverTema('oscuro', false)).toBe('oscuro');
  });
  it('sin elección válida sigue al dispositivo', () => {
    expect(resolverTema(null, true)).toBe('oscuro');
    expect(resolverTema('basura', false)).toBe('claro');
  });
});

/** Ejecuta el script en línea contra un navegador falso. */
function correr(o: { guardado?: string; oscuro: boolean; bloqueado?: boolean }) {
  const dataset: Record<string, string> = {};
  const meta = { content: '', setAttribute(_k: string, v: string) { this.content = v; } };
  const almacen = new Map<string, string>(o.guardado ? [[CLAVE_TEMA, o.guardado]] : []);
  let oyente: ((e: { matches: boolean }) => void) | null = null;
  const eventos: string[] = [];

  const localStorage = {
    getItem: (k: string) => { if (o.bloqueado) throw new Error('bloqueado'); return almacen.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (o.bloqueado) throw new Error('bloqueado'); almacen.set(k, v); },
  };
  const document = {
    documentElement: { dataset },
    querySelector: () => meta,
    dispatchEvent: (e: { type: string }) => { eventos.push(e.type); return true; },
  };
  const window: any = {
    matchMedia: () => ({ matches: o.oscuro, addEventListener: (_t: string, f: typeof oyente) => { oyente = f; } }),
  };
  class CustomEvent { constructor(public type: string, public detail?: unknown) {} }

  new Function('window', 'document', 'localStorage', 'CustomEvent', SCRIPT_TEMA)(window, document, localStorage, CustomEvent);
  return { dataset, meta, almacen, eventos, api: window.__wozialTema, dispositivo: (m: boolean) => oyente?.({ matches: m }) };
}

describe('SCRIPT_TEMA', () => {
  it('aplica el tema del dispositivo y el color de barra', () => {
    const n = correr({ oscuro: true });
    expect(n.dataset.tema).toBe('oscuro');
    expect(n.meta.content).toBe(COLOR_BARRA.oscuro);
  });

  it('respeta la elección guardada', () => {
    expect(correr({ guardado: 'claro', oscuro: true }).dataset.tema).toBe('claro');
  });

  it('elegir guarda, aplica y avisa', () => {
    const n = correr({ oscuro: false });
    n.api.elegir('oscuro');
    expect(n.dataset.tema).toBe('oscuro');
    expect(n.almacen.get(CLAVE_TEMA)).toBe('oscuro');
    expect(n.eventos).toContain('wozial:tema');
  });

  it('sigue al dispositivo en vivo solo si nunca se eligió', () => {
    const libre = correr({ oscuro: false });
    libre.dispositivo(true);
    expect(libre.dataset.tema).toBe('oscuro');

    const fijo = correr({ guardado: 'claro', oscuro: false });
    fijo.dispositivo(true);
    expect(fijo.dataset.tema).toBe('claro');
  });

  it('con localStorage bloqueado funciona sin guardar', () => {
    const n = correr({ oscuro: true, bloqueado: true });
    expect(n.dataset.tema).toBe('oscuro');
    expect(() => n.api.elegir('claro')).not.toThrow();
    expect(n.dataset.tema).toBe('claro');
  });
});
