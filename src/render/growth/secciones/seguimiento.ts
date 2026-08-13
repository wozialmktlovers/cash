import { cabeceraSeccion, tablaGrowth, listaGrowth } from './comunes';
import type { Growth } from '@/growth/schemas';

/** Qué medir y cuándo cortar. El calendario se ajusta a las semanas de la campaña. */
export function seccionSeguimiento(g: Partial<Growth>): string {
  const semanas = g.semanas ?? 4;

  return `
    ${cabeceraSeccion({
      numero: '09', kicker: 'Seguimiento', titulo: 'Qué medir y cuándo cortar',
      lead: 'Decidido por adelantado, para que la decisión no dependa del ánimo del día.',
    })}

    <h3 style="margin-top:22px;">Calendario de ${semanas} semanas</h3>
    ${tablaGrowth(['Momento', 'Qué se mira', 'Qué se hace'], [
      ['<strong>Días 1 a 3</strong>', 'Que las URLs registren y que los eventos lleguen', 'No se toca nada más. Optimizar con tres días de datos es leer ruido'],
      ['<strong>Día 4</strong>', 'Costo por resultado de cada ángulo', 'Se pausa el ángulo más caro solo si dobla al mejor'],
      ['<strong>Semana 2</strong>', 'El cruce de ángulo y formato', 'Se concentra el presupuesto en la combinación ganadora'],
      ['<strong>Semana 3</strong>', 'Búsquedas reales que activaron los anuncios', 'Se amplían negativas. Es donde más presupuesto se recupera'],
      [`<strong>Semana ${semanas}</strong>`, 'Costo por registro frente al valor del cliente', 'Se decide si se escala, se ajusta la oferta o se para'],
    ])}

    <h3 style="margin-top:26px;">Señales de cortar antes de tiempo</h3>
    ${listaGrowth([
      'Tráfico que llega y rebota en menos de diez segundos: el problema está en la página, no en la campaña. Más presupuesto lo amplifica en vez de resolverlo.',
      'Registros que nadie contesta en menos de una hora: el cuello no es el anuncio.',
      'Costo por registro por encima de lo que deja el margen, dos semanas seguidas.',
    ], 'lst lst-x')}

    <div class="alert alert-green" style="margin-top:18px;">
      <strong>Lo que no se mide en la primera vuelta.</strong> El retorno real no se conoce hasta que cierra el ciclo de compra completo. Juzgar la campaña por la venta del primer día castiga a los ángulos que trabajan arriba del embudo, que suelen ser los que sostienen el volumen después.
    </div>`;
}
