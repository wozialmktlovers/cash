import { escapar } from '@/render/escapar';
import { parsearMontos, formatearMonto } from './montos';

export type FilaGrafica = { nombre: string; min: number; max: number; destacada: boolean };

export function filasGrafica<T>(
  items: T[],
  nombre: (t: T) => string,
  texto: (t: T) => string,
  destacar: (t: T) => boolean = () => false,
): FilaGrafica[] {
  return items.flatMap((item) => {
    const montos = parsearMontos(texto(item));
    if (!montos.length) return [];
    return [{ nombre: nombre(item), min: Math.min(...montos), max: Math.max(...montos), destacada: destacar(item) }];
  });
}

// Un tope en cero o negativo (todos los montos en cero, o un dato corrupto)
// no debe dividir entre cero ni dar un porcentaje negativo: se dibuja vacío.
const pct = (n: number, tope: number) => (tope <= 0 ? 0 : Math.round((n / tope) * 100));

/** Barras horizontales. Con una sola fila no hay nada que comparar. */
export function graficaBarras(filas: FilaGrafica[], leyenda: string): string {
  if (filas.length < 2) return '';
  const tope = Math.max(...filas.map((f) => f.max));
  return `<figure class="grafica">
    <figcaption>${escapar(leyenda)}</figcaption>
    ${filas.map((f) => `<div class="barra-fila${f.destacada ? ' destacada' : ''}">
      <span class="barra-nombre">${escapar(f.nombre)}</span>
      <span class="barra-pista"><span class="barra-relleno" style="width:${pct(f.max, tope)}%"></span></span>
      <span class="barra-valor">${formatearMonto(f.max)}</span>
    </div>`).join('')}
  </figure>`;
}

/** Rangos de mínimo a máximo; un valor único se dibuja como punto. */
export function graficaRangos(filas: FilaGrafica[], leyenda: string): string {
  if (filas.length < 2) return '';
  const tope = Math.max(...filas.map((f) => f.max));
  return `<figure class="grafica">
    <figcaption>${escapar(leyenda)}</figcaption>
    ${filas.map((f) => {
      const unico = f.min === f.max;
      const izquierda = pct(f.min, tope);
      const marca = unico
        ? `<span class="rango-punto" style="left:${izquierda}%"></span>`
        : `<span class="rango-tramo" style="left:${izquierda}%;width:${pct(f.max, tope) - izquierda}%"></span>`;
      const valor = unico ? formatearMonto(f.max) : `${formatearMonto(f.min)} – ${formatearMonto(f.max)}`;
      return `<div class="barra-fila${f.destacada ? ' destacada' : ''}">
        <span class="barra-nombre">${escapar(f.nombre)}</span>
        <span class="barra-pista">${marca}</span>
        <span class="barra-valor">${valor}</span>
      </div>`;
    }).join('')}
  </figure>`;
}
