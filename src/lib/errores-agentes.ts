/**
 * Qué errores del SDK de Anthropic significan «para el trabajo entero» y cuáles
 * son solo un tropiezo de una etapa.
 *
 * Nace de un incidente real: la cuenta se quedó sin saldo a media
 * investigación, las cinco etapas paralelas trataron el 400 como un fallo de
 * etapa más y siguieron intentándolo mientras quedaba algo que gastar. El job
 * terminó con 3.54 USD cobrados, cero entregado y un «Ninguna etapa produjo
 * datos» que no le decía a nadie qué hacer.
 *
 * La distinción se hace por la forma exacta que trae el SDK
 * (`@anthropic-ai/sdk` 0.116), no por adivinar sobre el texto:
 *
 * - `APIError.status` es el código HTTP.
 * - `APIError.type` lo rellena el SDK con el `error.type` del cuerpo
 *   (`invalid_request_error`, `authentication_error`, `rate_limit_error`,
 *   `billing_error`…, ver `resources/shared.d.ts`).
 * - `APIError.error` es el cuerpo crudo, `{ type: 'error', error: { type, message } }`.
 * - `APIError.message` lo arma `makeMessage` como `"<status> <cuerpo en JSON>"`,
 *   que es por lo que en los registros de Railway se lee
 *   `BadRequestError: 400 {"type":"error","error":{...}}`.
 *
 * Se lee todo eso a mano en vez de con `instanceof APIError` a propósito: el
 * `instanceof` falla si alguna vez conviven dos copias del SDK en
 * `node_modules`, y no cuesta nada no depender de ello. Nada aquí importa el
 * SDK, así que este módulo tampoco lo arrastra a quien lo use.
 */

export type MotivoCorte = 'saldo' | 'credenciales';

/**
 * Lo que ve la persona en la pantalla de progreso (`ProgresoJob` pinta el campo
 * `error` de `research_jobs` tal cual, en rojo). Por eso dice qué pasó y qué
 * hacer, y no lleva ni el volcado del SDK ni el código de estado.
 */
export const MENSAJE_SALDO =
  'Se agotó el saldo de la cuenta de Anthropic. Recarga en console.anthropic.com y vuelve a lanzarlo.';

export const MENSAJE_CREDENCIALES =
  'La llave de Anthropic no es válida o no tiene permiso para este modelo. Revisa ANTHROPIC_API_KEY y vuelve a lanzarlo.';

export const MENSAJE_CORTE: Record<MotivoCorte, string> = {
  saldo: MENSAJE_SALDO,
  credenciales: MENSAJE_CREDENCIALES,
};

/** El error que corta un trabajo. Su `message` ya es el texto para la persona. */
export class CorteDeTrabajo extends Error {
  readonly motivo: MotivoCorte;
  /** El error del SDK que lo provocó, para los registros. */
  readonly causa: unknown;

  constructor(motivo: MotivoCorte, causa?: unknown) {
    super(MENSAJE_CORTE[motivo]);
    this.name = 'CorteDeTrabajo';
    this.motivo = motivo;
    this.causa = causa;
  }
}

/** Caja compartida: las etapas paralelas anotan aquí el corte y `vigilar` lo lee. */
export type Corte = { valor: CorteDeTrabajo | null };

export const nuevaCaja = (): Corte => ({ valor: null });

/**
 * El único texto que distingue «te quedaste sin saldo» de cualquier otro 400.
 * Un 400 normal (un parámetro mal puesto por un agente concreto) NO corta el
 * trabajo: es culpa de esa etapa y las demás pueden seguir.
 */
const SIN_SALDO = /credit balance is too low|insufficient credit/i;

function forma(error: unknown): { status?: number; tipo?: string; texto: string } {
  const e = (error ?? {}) as Record<string, any>;
  const status = typeof e.status === 'number' ? e.status : undefined;
  // `e.type` lo pone el SDK; `e.error.error.type` es el cuerpo crudo, por si
  // alguna vez llega un error armado a mano sin pasar por `APIError.generate`.
  const delCuerpo = e.error?.error;
  const tipo = typeof e.type === 'string' ? e.type
    : typeof delCuerpo?.type === 'string' ? delCuerpo.type
    : undefined;
  // El mensaje del SDK ya trae el cuerpo en JSON, pero se concatena también el
  // del cuerpo por si `makeMessage` cambia de formato en una versión futura.
  const texto = [
    typeof e.message === 'string' ? e.message : '',
    typeof delCuerpo?.message === 'string' ? delCuerpo.message : '',
  ].join(' ');
  return { status, tipo, texto };
}

/**
 * `null` = seguir adelante (la etapa falló, el trabajo no). Un motivo = no tiene
 * caso ni reintentar ni dejar que las hermanas sigan quemando lo que queda.
 */
export function motivoDeCorte(error: unknown): MotivoCorte | null {
  if (error instanceof CorteDeTrabajo) return error.motivo;

  // Sin llave ni se sale a la red: `claude.ts` lanza este Error pelado.
  if (error instanceof Error && error.message.includes('Falta ANTHROPIC_API_KEY')) return 'credenciales';

  const { status, tipo, texto } = forma(error);

  // Lo temporal se descarta PRIMERO, para que ninguna regla de abajo pueda
  // confundirlo con algo definitivo. El 429 de límite de peticiones es el caso
  // que más importa: se resuelve solo esperando, y abortar el trabajo por él
  // sería tirar a la basura una investigación que iba bien.
  if (status === 429 || tipo === 'rate_limit_error') return null;
  if (status !== undefined && status >= 500) return null;
  if (tipo === 'overloaded_error' || tipo === 'api_error' || tipo === 'timeout_error') return null;
  if (status === 408 || status === 409) return null;

  // Saldo. `billing_error` es el tipo que el SDK ya declara para esto; el 400
  // con el texto de la consola es la forma que de verdad llegó en producción.
  if (tipo === 'billing_error') return 'saldo';
  if (status === 400 && SIN_SALDO.test(texto)) return 'saldo';

  // Credenciales: llave inválida (401) o sin permiso para el recurso (403).
  if (status === 401 || tipo === 'authentication_error') return 'credenciales';
  if (status === 403 || tipo === 'permission_error') return 'credenciales';

  // Todo lo demás —red caída, JSON inválido, un 400 por un parámetro mal
  // puesto, una negativa del modelo— es cosa de la etapa, no del trabajo.
  return null;
}

/** Atajo legible: `true` si este error debe parar el trabajo entero. */
export const esCorte = (error: unknown): boolean => motivoDeCorte(error) !== null;

/**
 * Anota el corte en la caja y lo lanza, para usar dentro del `catch` de una
 * etapa secuencial: la etapa ya quedó marcada, y esto saca el control del
 * pipeline sin ejecutar las etapas que vienen después.
 */
export function cortar(corte: Corte, error: unknown): void {
  const motivo = motivoDeCorte(error);
  if (!motivo) return;
  corte.valor ??= new CorteDeTrabajo(motivo, error);
  throw corte.valor;
}
