export type Tema = 'claro' | 'oscuro';

export const CLAVE_TEMA = 'wozial-tema';

/** Color de la barra del navegador en celular; iguala a --fondo de cada tema. */
export const COLOR_BARRA: Record<Tema, string> = { claro: '#FFFFFF', oscuro: '#111017' };

export function resolverTema(guardado: string | null, prefiereOscuro: boolean): Tema {
  if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  return prefiereOscuro ? 'oscuro' : 'claro';
}

/**
 * Va en línea dentro del <head>, antes de la hoja de estilos: si se cargara
 * como módulo, cada página pintaría un cuadro en claro antes de pasar a oscuro.
 * Por eso no puede importar nada y repite en ES5 la regla de resolverTema.
 */
export const SCRIPT_TEMA = `(function () {
  var clave = ${JSON.stringify(CLAVE_TEMA)};
  var colores = ${JSON.stringify(COLOR_BARRA)};
  var guardado = null;
  try { guardado = localStorage.getItem(clave); } catch (e) {}
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function elegido() { return guardado === 'claro' || guardado === 'oscuro'; }
  function aplicar(t) {
    document.documentElement.dataset.tema = t;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', colores[t]);
    document.dispatchEvent(new CustomEvent('wozial:tema', { detail: t }));
  }
  aplicar(elegido() ? guardado : (mq.matches ? 'oscuro' : 'claro'));
  window.__wozialTema = {
    elegir: function (t) {
      guardado = t;
      try { localStorage.setItem(clave, t); } catch (e) {}
      aplicar(t);
    }
  };
  if (mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      if (!elegido()) aplicar(e.matches ? 'oscuro' : 'claro');
    });
  }
})();`;
