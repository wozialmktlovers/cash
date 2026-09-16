import { describe, it, expect } from 'vitest';
import { renderizarContenido } from '@/render/contenido/documento';
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
