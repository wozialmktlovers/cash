// Reconocer una violación de restricción única de Postgres por el nombre de la
// restricción que se rompió.
//
// Existe para que una ruta pueda contestar 409 sin un `SELECT` previo: entre la
// consulta y la escritura cabe otra petición con el mismo valor, así que la
// restricción de la base es la única comprobación libre de carreras. El primero
// que lo necesitó fue el correo de `PATCH /api/admin/usuarios/[id]`; la API de
// lotes y piezas necesita lo mismo para `(client_id, periodo)` y para
// `(lote_id, numero)`, así que el reconocimiento vive aquí una sola vez.
//
// postgres.js lanza un error con los campos que mandó el servidor (`code`,
// `constraint_name`) y Drizzle lo envuelve dejando el original en `cause`, de
// modo que hay que recorrer la cadena. Además del código 23505 se exige que se
// nombre LA restricción esperada: cualquier otra unicidad se relanza, que es lo
// prudente — no vaya a ser que un fallo distinto se disfrace del choque que sí
// sabemos explicar y quien llama corrija lo que no está mal.

/** Tope de saltos por la cadena de `cause`, por si alguien la vuelve cíclica. */
const SALTOS = 5;

/** Código SQLSTATE de «unique_violation». */
const UNIQUE_VIOLATION = '23505';

export function violaRestriccionUnica(error: unknown, restriccion: string): boolean {
  for (let actual: unknown = error, saltos = 0; actual && saltos < SALTOS; saltos++) {
    const e = actual as { code?: unknown; constraint_name?: unknown; message?: unknown; cause?: unknown };
    const nombraLaRestriccion =
      e.constraint_name === restriccion ||
      (typeof e.message === 'string' && e.message.includes(restriccion));
    if (e.code === UNIQUE_VIOLATION && nombraLaRestriccion) return true;
    actual = e.cause;
  }
  return false;
}
