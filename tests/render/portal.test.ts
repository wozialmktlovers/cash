// Documento aprobado en el portal del cliente + observaciones (spec §4, C2).
//
// Estos tests cubren la forma en que `/portal/documentos/[etapaId].astro`
// llama a los renders (sin `operador`, `editable: false`, con `volver` y,
// solo en manual_campana, `flujo`/`anclas`/ayuda) — la página en sí no se
// prueba aquí porque toca base de datos (igual que el resto de las rutas de
// Astro en este repo); lo que hace la página está cubierto por las pruebas
// puras de `src/lib/portal.ts` (C1) y por la verificación con curl del brief.
import { describe, it, expect } from 'vitest';
import { renderizarInvestigacion } from '@/render/investigacion/documento';
import { renderizarPilares } from '@/render/pilares/documento';
import { renderizarManual } from '@/render/growth/manual';
import { panelComentarios, SCRIPT_FLUJO, type FlujoDatos } from '@/render/editorial/flujo-cliente';
import investigacionCompleta from '../fixtures/investigacion-completa.json';
import growthCompleto from '../fixtures/growth-completo.json';
import { mapaFalso } from '../fixtures/pilares';

const volver = { href: '/portal', texto: '← Mi portal' };
const AYUDA = 'Selecciona una parte del documento para dejar una observación a tu equipo';

/** Deshace el escapado de `escapar()` para poder leer el JSON de `data-flujo` tal cual. */
function decodificar(html: string): string {
  return html.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

describe('portal del cliente: documento aprobado (C2)', () => {
  it('investigación (research): sin Compartir, sin data-editable, sin /api/share y sin data-flujo, con el enlace de vuelta', () => {
    const html = renderizarInvestigacion(
      investigacionCompleta as any,
      { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-09-15' },
      undefined, false, undefined, false, volver,
    );
    expect(html).not.toContain('Compartir');
    // `[data-editable]` sigue en la hoja de estilos compartida (una regla
    // fija, para cuando la vista interna sí lo use) — lo que nunca debe
    // aparecer es el atributo puesto en un elemento.
    expect(html).not.toContain('data-editable="');
    expect(html).not.toContain('/api/share');
    expect(html).not.toMatch(/<body[^>]*data-flujo=/);
    // La investigación no tiene observaciones (solo manual_campana/desarrollo_mensual):
    // ni rastro de `puedeComentar` en ninguna forma, escapada o no.
    expect(decodificar(html)).not.toContain('puedeComentar');
    expect(html).toContain('← Mi portal');
  });

  it('mapa de pilares: sin estados/notas/CSV internos (sin operador → interna=false), sin Compartir, con el enlace de vuelta', () => {
    const mapa = mapaFalso();
    const html = renderizarPilares(mapa, { cliente: 'Ana Villa', fecha: '2026-09-15' }, { editable: false, anclas: false, volver });
    expect(html).not.toContain('Compartir');
    expect(html).not.toContain('data-editable="');
    expect(html).not.toContain('/api/share');
    expect(html).not.toMatch(/<body[^>]*data-flujo=/);
    expect(html).toContain('← Mi portal');
  });

  it('manual de campaña (growth), cliente con permiso de comentar: data-flujo con puedeComentar true, anclas, botones y ayuda', () => {
    const flujo: FlujoDatos = {
      tipo: 'growth', id: 'd1', etapaId: 'e1', puedeEditar: false, puedeComentar: true, rol: 'cliente', esOperadorAsignado: false,
    };
    const html = renderizarManual(
      growthCompleto as any,
      { cliente: 'Ana Villa', producto: 'Diplomado', fecha: '2026-09-15' },
      '', false, flujo,
      { volverHref: '/portal', volverTexto: '← Mi portal', ayudaComentarios: AYUDA },
    );
    expect(html).not.toContain('Compartir');
    expect(html).not.toContain('data-editable="');
    expect(html).not.toContain('/api/share');
    expect(html).toMatch(/<body[^>]*data-flujo=/);
    expect(decodificar(html)).toContain('"puedeComentar":true');
    expect(decodificar(html)).toContain('"rol":"cliente"');
    expect(html).toContain('id="btn-flujo-comentar"');
    expect(html).toContain('id="btn-flujo-comentarios"');
    expect(html).toContain('data-ancla="seccion:meta"');
    expect(html).toContain(AYUDA);
    expect(html).toContain('← Mi portal');
  });

  it('manual de campaña, sin permiso de comentar (etapa que no lo permite, o vista previa interna): sin botón de Comentar', () => {
    const flujo: FlujoDatos = {
      tipo: 'growth', id: 'd1', etapaId: 'e1', puedeEditar: false, puedeComentar: false, rol: 'cliente', esOperadorAsignado: false,
    };
    const html = renderizarManual(
      growthCompleto as any,
      { cliente: 'Ana Villa', producto: 'Diplomado', fecha: '2026-09-15' },
      '', false, flujo,
      { volverHref: '/portal?cliente=c1', volverTexto: '← Mi portal' },
    );
    expect(decodificar(html)).toContain('"puedeComentar":false');
    expect(html).not.toContain('id="btn-flujo-comentar"');
    expect(html).not.toContain('id="btn-flujo-comentarios"');
    // El panel de comentarios (para ver hilos ya existentes) tampoco se
    // ofrece sin `puedeComentar` — mismo criterio que la vista interna.
    // (SCRIPT_FLUJO sigue trayendo el `getElementById('dialog-comentarios')`
    // porque es un único script compartido; lo que importa es que el propio
    // elemento del diálogo no se rinda.)
    expect(html).not.toContain('id="dialog-comentarios"');
  });

  it('manual de campaña sin `portal` (vista pública /p/...): sin el enlace de vuelta ni botones de observaciones', () => {
    const html = renderizarManual(growthCompleto as any, { cliente: 'Ana Villa', producto: 'Diplomado', fecha: '2026-09-15' });
    expect(html).not.toContain('← Mi portal');
    expect(html).not.toContain('id="btn-flujo-comentar"');
  });
});

// Fix menores, punto 3: banda «Vista previa del portal» cuando admin/operador
// abren el documento aprobado desde el portal en modo previsualización
// (`vistaPrevia: true` en `volver`/`portal`), y su ausencia para el cliente
// real (`vistaPrevia` ausente o `false`).
describe('portal del cliente: banda «Vista previa» (fix menores, punto 3)', () => {
  // La clase `.banda-vista-previa` también vive en la hoja de estilos en
  // línea (siempre presente): lo que hay que comprobar es el `<div>` en el
  // marcado, no la subcadena suelta del nombre de la clase.
  const BANDA = '<div class="banda-vista-previa"';

  it('investigación: con vistaPrevia trae la banda; sin ella (cliente real), no', () => {
    const conPrevia = renderizarInvestigacion(
      investigacionCompleta as any,
      { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-09-15' },
      undefined, false, undefined, false, { ...volver, vistaPrevia: true },
    );
    expect(conPrevia).toContain(BANDA);
    expect(conPrevia).toContain('<body data-vista-previa>');

    const sinPrevia = renderizarInvestigacion(
      investigacionCompleta as any,
      { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-09-15' },
      undefined, false, undefined, false, volver,
    );
    expect(sinPrevia).not.toContain(BANDA);
    expect(sinPrevia).not.toContain('<body data-vista-previa>');
  });

  it('mapa de pilares: con vistaPrevia trae la banda; sin ella, no', () => {
    const mapa = mapaFalso();
    const conPrevia = renderizarPilares(mapa, { cliente: 'Ana Villa', fecha: '2026-09-15' }, { editable: false, anclas: false, volver: { ...volver, vistaPrevia: true } });
    expect(conPrevia).toContain(BANDA);

    const sinPrevia = renderizarPilares(mapa, { cliente: 'Ana Villa', fecha: '2026-09-15' }, { editable: false, anclas: false, volver });
    expect(sinPrevia).not.toContain(BANDA);
  });

  it('manual de campaña: con vistaPrevia trae la banda; sin ella, no', () => {
    const conPrevia = renderizarManual(
      growthCompleto as any,
      { cliente: 'Ana Villa', producto: 'Diplomado', fecha: '2026-09-15' },
      '', false, undefined,
      { volverHref: '/portal', volverTexto: '← Mi portal', vistaPrevia: true },
    );
    expect(conPrevia).toContain(BANDA);
    expect(conPrevia).toContain('<body data-vista-previa>');

    const sinPrevia = renderizarManual(
      growthCompleto as any,
      { cliente: 'Ana Villa', producto: 'Diplomado', fecha: '2026-09-15' },
      '', false, undefined,
      { volverHref: '/portal', volverTexto: '← Mi portal' },
    );
    expect(sinPrevia).not.toContain(BANDA);
    expect(sinPrevia).not.toContain('<body data-vista-previa>');
  });
});

describe('panel de comentarios: texto de ayuda del portal (C2)', () => {
  it('sin ayuda (vista interna) no cambia', () => {
    expect(panelComentarios()).not.toContain('panel-ayuda');
  });

  it('con ayuda, la incluye escapada', () => {
    const html = panelComentarios('<script>alert(1)</script>');
    expect(html).toContain('panel-ayuda');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('SCRIPT_FLUJO: abrir el panel desde #observaciones (C2)', () => {
  it('revisa el hash de la URL y hace clic en el botón de comentarios cuando puede comentar', () => {
    expect(SCRIPT_FLUJO).toContain("window.location.hash === '#observaciones'");
    expect(SCRIPT_FLUJO).toContain('btnComentarios.click()');
  });

  it('sigue siendo JavaScript válido', () => {
    expect(() => new Function(SCRIPT_FLUJO)).not.toThrow();
  });
});
