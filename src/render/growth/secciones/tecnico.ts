import { escapar, cabeceraSeccion, listaGrowth, tablaGrowth, chips, hueco } from './comunes';
import type { MetaManual } from './portada';
import type { Growth } from '@/growth/schemas';

/**
 * Implementación técnica.
 *
 * Cuando el agente entrega la arquitectura, se rinde la matriz de capas y la
 * lista de etiquetas con sus activadores: eso es lo que se copia al montar el
 * contenedor. Sin ella queda la receta genérica, que sirve de guía pero
 * obliga a decidir sobre la marcha.
 */
export function seccionTecnico(meta: MetaManual, g: Partial<Growth> = {}): string {
  const t = g.tecnico;
  if (t) {
    return `
    ${cabeceraSeccion({
      numero: '07', kicker: 'Implementación', titulo: 'GTM, GA4, píxel y etiquetas',
      lead: 'Todo pasa por un solo contenedor de Tag Manager. Nada se instala directo en el código: así se cambia sin tocar el sitio.',
    })}

    <h3 style="margin-top:22px;">Arquitectura de medición</h3>
    ${tablaGrowth(['Capa', 'Herramienta', 'Función', 'Identificador'],
      t.arquitectura.map((c) => [
        `<strong>${escapar(c.capa)}</strong>`, escapar(c.herramienta), escapar(c.funcion),
        `<code class="pre">${escapar(c.identificador)}</code>`]))}

    <div class="g2" style="margin-top:22px;">
      <div class="card">
        <h4>Etiquetas a crear en GTM</h4>
        <div style="margin-top:10px;">
          ${tablaGrowth(['Etiqueta', 'Activador'],
            t.etiquetas.map((e) => [`<strong>${escapar(e.etiqueta)}</strong>`, escapar(e.activador)]))}
        </div>
      </div>
      <div class="card">
        <h4>Variables a activar</h4>
        <div style="margin-top:10px;">${chips(t.variables, 'chip chip-k')}</div>
        <div class="alert alert-red" style="margin-top:14px;">
          <strong>Esto va antes que el primer peso invertido.</strong> Una campaña que corre sin medición no se puede optimizar, y lo gastado esos días no se recupera con datos.
        </div>
      </div>
    </div>

    <h3 style="margin-top:24px;">Lo que se rompe más a menudo</h3>
    ${listaGrowth([
      'El contenedor se crea pero no se publica: el sitio no carga ninguna etiqueta y el reporte queda a cero.',
      'El píxel se pega en el sitio y también en GTM: cada visita se cuenta dos veces y el costo por resultado aparece a la mitad.',
      'La conversión se define sobre la carga de la página de gracias, pero esa página es accesible por URL directa: cualquiera la infla.',
      'La plataforma de pago abre en otro dominio y pierde los UTM: la venta aparece como tráfico directo.',
    ], 'lst lst-x')}`;
  }

  return `
    ${cabeceraSeccion({
      numero: '08', kicker: 'Implementación', titulo: 'GTM, GA4, píxel y etiquetas',
      lead: 'El orden importa: sin el contenedor publicado, todo lo demás mide en el vacío.',
    })}

    <div class="alert alert-red" style="margin-top:20px;">
      <strong>Esto va antes que el primer peso invertido.</strong> Una campaña que corre sin medición no se puede optimizar, y lo gastado esos días no se recupera con datos.
    </div>

    <h3 style="margin-top:26px;">Orden de instalación</h3>
    ${tablaGrowth(['Paso', 'Qué se hace', 'Cómo se comprueba'], [
      ['<strong>1</strong>', 'Crear el contenedor de Google Tag Manager y publicarlo', 'La vista previa de GTM carga en el sitio de ' + escapar(meta.cliente)],
      ['<strong>2</strong>', 'Crear la propiedad de GA4 y conectarla desde GTM', 'El informe en tiempo real registra tu propia visita'],
      ['<strong>3</strong>', 'Instalar el píxel de Meta como etiqueta de GTM', 'El probador de eventos de Meta marca PageView'],
      ['<strong>4</strong>', 'Instalar la etiqueta de Google Ads y su conversión', 'El diagnóstico de la conversión deja de decir «sin actividad reciente»'],
      ['<strong>5</strong>', 'Marcar el evento de registro como conversión en las tres', 'Una prueba real de punta a punta aparece en GA4, Meta y Ads'],
    ])}

    <h3 style="margin-top:26px;">Lo que se rompe más a menudo</h3>
    ${listaGrowth([
      'El contenedor se crea pero no se publica: el sitio no carga ninguna etiqueta y el reporte queda a cero.',
      'El píxel se pega en el sitio y también en GTM: cada visita se cuenta dos veces y el costo por resultado aparece a la mitad.',
      'La conversión se define sobre la carga de la página de gracias, pero esa página es accesible por URL directa: cualquiera la infla.',
      'La plataforma de pago abre en otro dominio y pierde los UTM: la venta aparece como tráfico directo.',
    ], 'lst lst-x')}`;
}
