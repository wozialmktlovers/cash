/**
 * Reglas puras del borrado de un cliente (spec §2). Viven aparte del endpoint
 * para poder probarlas sin base ni servidor, y sobre todo para que la pantalla
 * y el servidor usen exactamente la misma comparación: si difirieran, el
 * diálogo habilitaría un botón que la API va a rechazar, que es la peor forma
 * de fallar en una acción que no se puede deshacer.
 */

/** Lo que se va a perder, contado de verdad sobre la base. */
export type ConteosBorrado = {
  /** Investigaciones + mapas de pilares + manuales de campaña. */
  entregables: number;
  /** Filas de `client_files`, que además tienen un archivo en el disco de datos. */
  archivos: number;
  /** Usuarios con rol `cliente` atados a este cliente. */
  cuentas: number;
  /** Sitio, redes y páginas de venta de la ficha. */
  enlaces: number;
};

/**
 * ¿El nombre tecleado autoriza el borrado?
 *
 * La regla es **exacta**, con dos concesiones que no aflojan nada:
 *
 * 1. Se recortan los espacios de los extremos. El nombre guardado ya viene
 *    recortado (`clienteSchema` usa `.trim()`), así que un espacio sobrante
 *    solo puede venir de un pegado o del teclado del celular; nunca es una
 *    diferencia que una persona pueda ver en pantalla ni corregir a ciegas.
 * 2. Ambos lados se normalizan a NFC. Una «Á» tecleada en un Mac puede llegar
 *    descompuesta (A + acento combinante) y no coincidir byte a byte con la
 *    guardada, siendo idéntica a la vista.
 *
 * Todo lo demás se compara carácter por carácter: mayúsculas, acentos,
 * puntuación y espacios interiores tienen que coincidir. Ese es el punto del
 * trámite —obligar a leer el nombre, no a adivinarlo—, y por eso no se baja
 * a minúsculas ni se colapsan los espacios de en medio.
 */
export function nombreConfirmado(escrito: unknown, real: string): boolean {
  if (typeof escrito !== 'string') return false;
  const normalizar = (s: string) => s.trim().normalize('NFC');
  const tecleado = normalizar(escrito);
  // Un cliente sin nombre no debería existir (la columna es NOT NULL y el
  // schema exige un mínimo de 1), pero si llegara vacío, un campo vacío no
  // puede valer como confirmación.
  if (tecleado === '') return false;
  return tecleado === normalizar(real);
}

/** Una línea del diálogo: la cantidad aparte para poder resaltarla. */
export type ItemPerdida = { cantidad: number; texto: string };

/**
 * Lo que enumera el diálogo, con las cantidades reales. Se listan los cuatro
 * renglones aunque alguno sea cero: un cero también informa («este cliente no
 * tiene cuentas de acceso») y deja la lista siempre con la misma forma, en vez
 * de cambiar de tamaño según el cliente.
 */
export function itemsPerdida(c: ConteosBorrado): ItemPerdida[] {
  return [
    { cantidad: c.entregables, texto: c.entregables === 1
      ? 'entregable (investigación, mapa de pilares o manual), con todas sus versiones y comentarios'
      : 'entregables (investigaciones, mapas de pilares y manuales), con todas sus versiones y comentarios' },
    { cantidad: c.archivos, texto: c.archivos === 1 ? 'archivo subido, que se borra también del disco' : 'archivos subidos, que se borran también del disco' },
    { cantidad: c.cuentas, texto: c.cuentas === 1
      ? 'cuenta de acceso del cliente, que dejará de poder entrar al portal'
      : 'cuentas de acceso del cliente, que dejarán de poder entrar al portal' },
    { cantidad: c.enlaces, texto: c.enlaces === 1 ? 'enlace de la ficha' : 'enlaces de la ficha' },
  ];
}
