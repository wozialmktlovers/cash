// El paso «Elegir los temas del mes» de la generación con IA (rediseño
// 2026-09-30). Antes de que la IA escriba nada, el sistema propone qué tema del
// mapa de pilares va en cada pieza del mes —sin IA y sin costo— y el equipo lo
// acepta o lo cambia fila por fila; al autorizar se guarda quién y cuándo y
// recién entonces se lanza el trabajo de IA, que escribe sobre esos temas y no
// elige ninguno.
//
// Es una isla de React, y vive dentro de `GenerarMes` (PiezasEditor.tsx), que
// es quien pregunta «completar o reemplazar» y le pasa el resultado. Tres
// decisiones:
//
// 1. **El servidor manda.** La propuesta la calcula `POST …/temas` y el
//    borrador se guarda con `PUT …/temas` en cuanto el equipo toca algo
//    (con una pausa corta): recargar la página no pierde la selección a
//    medias. Las mismas reglas de validación corren en el navegador solo para
//    no ofrecer lo que el servidor rechazaría (un tema repetido en el mes).
// 2. **Cualquier tema del banco se puede elegir**, de cualquier pilar; el
//    selector marca los pendientes y los que ya se usaron en otro mes, y deja
//    sin opción el que ya está en otra fila del mismo mes.
// 3. **El paquete no se rompe en silencio.** Las filas son las que faltan del
//    paquete; se pueden cambiar de formato, pero si el conteo deja de cuadrar
//    se avisa y autorizar exige confirmarlo.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FORMATOS, type Formato } from '@/contenido/reglas';
import type { Modo } from '@/contenido/mes/reemplazo';
import { nombrePeriodo } from '@/lib/ui/periodo';
import { toast } from '@/scripts/toast';

/** Un tema del banco del mapa de pilares, con lo que el selector necesita para elegirlo con criterio. */
export type TemaBanco = {
  id: string;
  texto: string;
  subcategoria: string;
  funcion: string;
  formato: string;
  pilar: number;
  estado: string;
  /** El mes (`AAAA-MM`) de OTRO lote donde ya se usó, o `null`. */
  usadoEn: string | null;
};

export type FilaUI = { ref: number; formato: Formato; fecha: string; temaId: string | null };
export type SeleccionUI = { modo: Modo; incluirConArte: boolean; filas: FilaUI[] };

const NOMBRE_FORMATO: Record<Formato, string> = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };
const NOMBRE_FUNCION: Record<string, string> = {
  autoridad: 'Autoridad', conexion: 'Conexión', engagement: 'Conversación', prueba_social: 'Prueba social', venta: 'Venta',
};
const NOMBRE_ESTADO: Record<string, { texto: string; color: string }> = {
  pendiente: { texto: 'Pendiente', color: 'azul' },
  en_desarrollo: { texto: 'En desarrollo', color: 'amarillo' },
  desarrollado: { texto: 'Desarrollado', color: 'verde' },
  publicado: { texto: 'Publicado', color: 'gris' },
};
const FORMATO_PLURAL: Record<Formato, [string, string]> = {
  post: ['post', 'posts'], carrusel: ['carrusel', 'carruseles'], reel: ['reel', 'reels'], historia: ['historia', 'historias'],
};
const cuenta = (n: number, f: Formato) => `${n} ${FORMATO_PLURAL[f][n === 1 ? 0 : 1]}`;

/** Sin acentos ni mayúsculas, para que «conexion» encuentre «Conexión». */
const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

/** Primer y último día del mes, para acotar el campo de fecha. */
function limitesDelMes(periodo: string): { min: string; max: string } {
  const [a, m] = periodo.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { min: `${periodo}-01`, max: `${periodo}-${String(ultimo).padStart(2, '0')}` };
}

async function pedir(url: string, metodo: 'POST' | 'PUT', cuerpo: unknown) {
  try {
    const res = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    return { status: res.status, cuerpo: await res.json().catch(() => ({})) };
  } catch {
    return null;
  }
}

export default function ElegirTemas({
  loteId, periodo, modo, incluirConArte, hayPiezas, esperadas, reemplazar, bloqueados, banco, nombresPilares,
  inicial, ultima, puedeElegir, razonSinPermiso,
}: {
  loteId: string;
  periodo: string;
  modo: Modo;
  incluirConArte: boolean;
  hayPiezas: boolean;
  /** Lo que falta del paquete con el modo elegido, por formato. */
  esperadas: Record<Formato, number>;
  /** Cuántas piezas se reemplazan con el modo elegido (pide confirmación). */
  reemplazar: number;
  /** Tema → número de la pieza del mes que se queda con él: no se puede repetir. */
  bloqueados: Record<string, number>;
  banco: TemaBanco[];
  nombresPilares: string[];
  /** El borrador guardado (sin autorizar), si lo hay. */
  inicial: SeleccionUI | null;
  /** La última autorización de este mes, para decir quién y cuándo. */
  ultima: { nombre: string; en: string } | null;
  puedeElegir: boolean;
  razonSinPermiso: string;
}) {
  const [seleccion, setSeleccion] = useState<SeleccionUI | null>(inicial);
  const [filas, setFilas] = useState<FilaUI[]>(inicial?.filas ?? []);
  const [proponiendo, setProponiendo] = useState(false);
  const [guardado, setGuardado] = useState<'listo' | 'guardando' | 'error'>('listo');
  const [errores, setErrores] = useState<string[]>([]);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [confirmaDesajuste, setConfirmaDesajuste] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviado = useRef(JSON.stringify(inicial?.filas ?? []));
  const secuencia = useRef(0);

  const porId = useMemo(() => new Map(banco.map((t) => [t.id, t])), [banco]);
  const { min, max } = limitesDelMes(periodo);
  const total = FORMATOS.reduce((s, f) => s + esperadas[f], 0);
  const hayDuplicados = new Set(filas.filter((f) => f.temaId).map((f) => f.temaId)).size !== filas.filter((f) => f.temaId).length;
  const sinTema = filas.filter((f) => !f.temaId).length;
  const lleva = Object.fromEntries(FORMATOS.map((f) => [f, filas.filter((x) => x.formato === f).length])) as Record<Formato, number>;
  const desajuste = FORMATOS.filter((f) => lleva[f] !== esperadas[f]);

  // Lo que se le propuso a otra opción de arriba (modo, arte) o a otro estado del mes.
  const desfasada = !!seleccion && (
    seleccion.modo !== modo || seleccion.incluirConArte !== (modo === 'reemplazar' && incluirConArte) || filas.length !== total
  );

  // Guardado automático del borrador, con una pausa para no mandar cada tecla.
  useEffect(() => {
    if (!seleccion || !puedeElegir) return;
    const texto = JSON.stringify(filas);
    if (texto === enviado.current) return;
    const mio = ++secuencia.current;
    setGuardado('guardando');
    const espera = setTimeout(async () => {
      const r = await pedir(`/api/contenido/lotes/${loteId}/temas`, 'PUT', { modo: seleccion.modo, incluirConArte: seleccion.incluirConArte, filas });
      if (mio !== secuencia.current) return; // llegó un cambio más nuevo
      if (r?.cuerpo?.ok) { enviado.current = texto; setGuardado('listo'); setErrores([]); return; }
      setGuardado('error');
      setErrores(r?.cuerpo?.errores ?? ['No se pudo guardar la selección.']);
    }, 600);
    return () => clearTimeout(espera);
  }, [filas, seleccion, puedeElegir, loteId]);

  async function proponer() {
    setErrores([]);
    setProponiendo(true);
    const r = await pedir(`/api/contenido/lotes/${loteId}/temas`, 'POST', { modo, incluirConArte: modo === 'reemplazar' && incluirConArte });
    setProponiendo(false);
    if (!r) { setErrores(['No se pudo contactar al servidor.']); return; }
    if (!r.cuerpo?.ok) { setErrores(r.cuerpo?.errores ?? ['No se pudieron proponer los temas.']); return; }
    const nueva: SeleccionUI = r.cuerpo.seleccion;
    enviado.current = JSON.stringify(nueva.filas);
    secuencia.current++;
    setSeleccion(nueva);
    setFilas(nueva.filas);
    setGuardado('listo');
    setAbierta(null);
    setConfirmaDesajuste(false);
    setConfirmando(false);
  }

  function cambiar(ref: number, cambio: Partial<FilaUI>) {
    setFilas((lista) => lista.map((f) => (f.ref === ref ? { ...f, ...cambio } : f)));
    setConfirmando(false);
  }

  async function autorizar() {
    setErrores([]);
    setEnviando(true);
    const r = await pedir(`/api/contenido/lotes/${loteId}/generar`, 'POST', {
      modo, incluirConArte: modo === 'reemplazar' && incluirConArte, filas, confirmarDesajuste: confirmaDesajuste,
    });
    setEnviando(false);
    setConfirmando(false);
    if (!r) { setErrores(['No se pudo contactar al servidor.']); return; }
    if (r.cuerpo?.ok) {
      toast('Temas autorizados. La IA empezó a escribir el mes; te avisamos en la campana al terminar.');
      location.href = `/jobs/${r.cuerpo.id}`;
      return;
    }
    if (r.cuerpo?.jobId) { location.href = `/jobs/${r.cuerpo.jobId}`; return; }
    setErrores(r.cuerpo?.errores ?? ['No se pudo lanzar la generación.']);
  }

  const puedeAutorizar = puedeElegir && !!seleccion && !desfasada && !hayDuplicados && sinTema === 0 && filas.length > 0
    && (desajuste.length === 0 || confirmaDesajuste) && guardado !== 'guardando' && !enviando;

  // ── Antes de proponer ────────────────────────────────────────────────
  if (!seleccion) {
    return (
      <>
        {ultima && (
          <p className="secundario" style={{ marginTop: 12 }}>
            Los últimos temas los autorizó {ultima.nombre || 'alguien del equipo'} el {fechaCorta(ultima.en.slice(0, 10))}.
          </p>
        )}
        {!puedeElegir && <p className="aviso amarillo" style={{ marginTop: 12 }}>{razonSinPermiso}</p>}
        <div className="acciones">
          <button type="button" className="btn" disabled={!puedeElegir || proponiendo || total === 0} onClick={() => void proponer()}>
            {proponiendo ? 'Proponiendo…' : 'Elegir los temas del mes'}
          </button>
        </div>
        {errores.length > 0 && <p className="aviso rosa" role="alert" style={{ marginTop: 14 }}>{errores.join(' · ')}</p>}
      </>
    );
  }

  // ── La lista editable ────────────────────────────────────────────────
  return (
    <div className="temas-mes">
      <h3>Temas de {nombrePeriodo(periodo)}</h3>
      <p className="sub">
        Estos son los temas que propone el sistema, tomados del mapa de pilares: pendientes primero, repartidos por pilar y
        por función del mix y sin repetir los de otros meses. Acepta los que te sirvan y cambia los demás por cualquier tema
        del banco. Hasta que los autorices, la IA no escribe nada ni cuesta un centavo.
      </p>

      {!puedeElegir && <p className="aviso amarillo">{razonSinPermiso}</p>}
      {desfasada && (
        <p className="aviso amarillo" role="status">
          Cambió lo que se va a escribir (la opción de arriba o las piezas del mes) y esta propuesta ya no corresponde.
          {puedeElegir ? ' Vuelve a proponer los temas.' : ''}
        </p>
      )}

      <ol className="tema-lista" aria-label="Temas propuestos, una fila por pieza">
        {filas.map((f) => {
          const tema = f.temaId ? porId.get(f.temaId) : undefined;
          const idAbierta = `tema-selector-${f.ref}`;
          return (
            <li className="tema-fila" key={f.ref}>
              <div className="tema-fila-cab">
                <strong>Pieza nueva {f.ref}</strong>
                {tema && (
                  <span className="tema-chips">
                    <span className="etiqueta">{nombresPilares[tema.pilar - 1] ?? `Pilar ${tema.pilar}`}</span>
                    <span className="etiqueta">{NOMBRE_FUNCION[tema.funcion] ?? tema.funcion}</span>
                  </span>
                )}
              </div>

              <div className="tema-fila-campos">
                <div className="campo">
                  <label htmlFor={`tema-formato-${f.ref}`}>Formato</label>
                  <select id={`tema-formato-${f.ref}`} value={f.formato} disabled={!puedeElegir}
                    onChange={(e) => cambiar(f.ref, { formato: e.target.value as Formato })}>
                    {FORMATOS.map((x) => <option key={x} value={x}>{NOMBRE_FORMATO[x]}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor={`tema-fecha-${f.ref}`}>Fecha propuesta</label>
                  <input id={`tema-fecha-${f.ref}`} type="date" min={min} max={max} value={f.fecha} disabled={!puedeElegir}
                    onChange={(e) => e.target.value && cambiar(f.ref, { fecha: e.target.value })} />
                </div>
              </div>

              <div className="tema-actual">
                {tema ? (
                  <>
                    <p className="tema-texto"><code className="tema-id">{tema.id}</code> {tema.texto}</p>
                    <p className="secundario">
                      {tema.subcategoria} · función {NOMBRE_FUNCION[tema.funcion]?.toLowerCase() ?? tema.funcion} · formato sugerido {tema.formato}
                    </p>
                    <p className="tema-chips">
                      <span className={`etiqueta ${NOMBRE_ESTADO[tema.estado]?.color ?? 'gris'}`}>{NOMBRE_ESTADO[tema.estado]?.texto ?? tema.estado}</span>
                      {tema.usadoEn && <span className="etiqueta rosa">Ya usado en {nombrePeriodo(tema.usadoEn)}</span>}
                    </p>
                  </>
                ) : (
                  <p className="aviso amarillo">
                    {f.temaId ? `El tema ${f.temaId} ya no está en el mapa.` : 'El mapa ya no tiene temas sin usar para esta pieza. Elige uno.'}
                  </p>
                )}
                {puedeElegir && (
                  <button type="button" className="btn fantasma chico" aria-expanded={abierta === f.ref} aria-controls={idAbierta}
                    onClick={() => setAbierta((a) => (a === f.ref ? null : f.ref))}>
                    {abierta === f.ref ? 'Cerrar' : tema ? 'Cambiar tema' : 'Elegir tema'}
                  </button>
                )}
              </div>

              {abierta === f.ref && (
                <SelectorDeTema
                  id={idAbierta}
                  fila={f}
                  banco={banco}
                  nombresPilares={nombresPilares}
                  ocupados={new Map(filas.filter((x) => x.temaId && x.ref !== f.ref).map((x) => [x.temaId!, `pieza nueva ${x.ref}`]))}
                  bloqueados={bloqueados}
                  onElegir={(id) => { cambiar(f.ref, { temaId: id }); setAbierta(null); }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {desajuste.length > 0 && filas.length === total && (
        <div className="aviso amarillo" role="status">
          <p>
            <strong>El paquete del cliente no cuadra con estas filas:</strong>{' '}
            {desajuste.map((f) => `pide ${cuenta(esperadas[f], f)} y llevas ${lleva[f]}`).join('; ')}.
          </p>
          {puedeElegir && (
            <label className="marca-confirmar">
              <input type="checkbox" checked={confirmaDesajuste} onChange={(e) => setConfirmaDesajuste(e.target.checked)} />
              <span>Sí, quiero generar el mes aunque no coincida con el paquete.</span>
            </label>
          )}
        </div>
      )}
      {hayDuplicados && <p className="aviso rosa" role="alert">Hay un tema repetido en el mes. Cambia una de las dos piezas.</p>}
      {sinTema > 0 && puedeElegir && <p className="aviso amarillo">Falta elegir el tema de {sinTema === 1 ? 'una pieza' : `${sinTema} piezas`}.</p>}

      {puedeElegir && (
        <div className="acciones">
          {confirmando ? (
            <>
              <span className="secundario">
                ¿Reemplazar {reemplazar} {reemplazar === 1 ? 'pieza' : 'piezas'}? Se borran al terminar de escribir las nuevas.
              </span>
              <button type="button" className="btn peligro lleno chico" disabled={enviando} onClick={() => void autorizar()}>
                {enviando ? 'Lanzando…' : 'Sí, reemplazar y generar'}
              </button>
              <button type="button" className="btn fantasma chico" onClick={() => setConfirmando(false)}>Cancelar</button>
            </>
          ) : (
            <>
              <button type="button" className="btn" disabled={!puedeAutorizar}
                onClick={() => (hayPiezas && modo === 'reemplazar' && reemplazar > 0 ? setConfirmando(true) : void autorizar())}>
                {enviando ? 'Lanzando…' : 'Autorizar temas y generar contenido'}
              </button>
              <button type="button" className="btn fantasma" disabled={proponiendo || enviando} onClick={() => void proponer()}>
                {proponiendo ? 'Proponiendo…' : 'Volver a proponer'}
              </button>
              <span className="secundario" role="status" aria-live="polite">
                {guardado === 'guardando' ? 'Guardando…' : guardado === 'error' ? 'No se guardó' : 'Selección guardada'}
              </span>
            </>
          )}
        </div>
      )}
      {errores.length > 0 && <p className="aviso rosa" role="alert" style={{ marginTop: 14 }}>{errores.join(' · ')}</p>}
    </div>
  );
}

// ── El selector de tema de una fila ─────────────────────────────────────

const MAX_OPCIONES = 40;

function SelectorDeTema({ id, fila, banco, nombresPilares, ocupados, bloqueados, onElegir }: {
  id: string;
  fila: FilaUI;
  banco: TemaBanco[];
  nombresPilares: string[];
  /** Temas que ya tiene otra fila de este mes → qué fila. */
  ocupados: Map<string, string>;
  bloqueados: Record<string, number>;
  onElegir: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [pilar, setPilar] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);

  const pilares = useMemo(() => [...new Set(banco.map((t) => t.pilar))].sort((a, b) => a - b), [banco]);
  const resultado = useMemo(() => {
    const q = plano(busqueda.trim());
    return banco
      .filter((t) => (!pilar || String(t.pilar) === pilar) && (!soloPendientes || t.estado === 'pendiente')
        && (!q || plano(`${t.id} ${t.texto} ${t.subcategoria}`).includes(q)))
      .sort((a, b) => Number(a.estado !== 'pendiente') - Number(b.estado !== 'pendiente') || a.id.localeCompare(b.id));
  }, [banco, busqueda, pilar, soloPendientes]);
  const visibles = resultado.slice(0, MAX_OPCIONES);

  return (
    <div className="tema-selector" id={id} role="group" aria-label={`Elegir el tema de la pieza nueva ${fila.ref}`}>
      <div className="tema-filtros">
        <div className="campo">
          <label htmlFor={`${id}-buscar`}>Buscar por palabra o código</label>
          <input id={`${id}-buscar`} type="search" value={busqueda} autoFocus onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej. P2-S1 o «precio»" />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-pilar`}>Pilar</label>
          <select id={`${id}-pilar`} value={pilar} onChange={(e) => setPilar(e.target.value)}>
            <option value="">Todos los pilares</option>
            {pilares.map((n) => <option key={n} value={n}>{nombresPilares[n - 1] ?? `Pilar ${n}`}</option>)}
          </select>
        </div>
        <label className="marca-confirmar">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          <span>Solo pendientes</span>
        </label>
      </div>

      <p className="secundario" role="status" aria-live="polite">
        {resultado.length === 0 ? 'Ningún tema coincide.' : `${resultado.length} ${resultado.length === 1 ? 'tema' : 'temas'}${resultado.length > visibles.length ? `; se muestran los primeros ${MAX_OPCIONES}, afina la búsqueda` : ''}.`}
      </p>
      <ul className="tema-opciones">
        {visibles.map((t) => {
          const otra = ocupados.get(t.id) ?? (bloqueados[t.id] !== undefined ? `pieza ${bloqueados[t.id]} del mes` : null);
          const actual = fila.temaId === t.id;
          return (
            <li key={t.id}>
              <button type="button" className={`tema-op${actual ? ' actual' : ''}`} disabled={!!otra} aria-pressed={actual} onClick={() => onElegir(t.id)}>
                <span className="tema-texto"><code className="tema-id">{t.id}</code> {t.texto}</span>
                <span className="secundario">{t.subcategoria} · {NOMBRE_FUNCION[t.funcion]?.toLowerCase() ?? t.funcion} · {t.formato}</span>
                <span className="tema-chips">
                  <span className={`etiqueta ${NOMBRE_ESTADO[t.estado]?.color ?? 'gris'}`}>{NOMBRE_ESTADO[t.estado]?.texto ?? t.estado}</span>
                  {t.usadoEn && <span className="etiqueta rosa">Ya usado en {nombrePeriodo(t.usadoEn)}</span>}
                  {otra && <span className="etiqueta amarillo">Ya está en la {otra}</span>}
                  {actual && <span className="etiqueta verde">Elegido</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
