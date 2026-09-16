// Armado del lote del mes: las cifras por formato, el aviso de cuadre con el
// paquete y la lista de piezas con alta, edición, artes y propuestas de copy
// (diseño §3, §4 y §5; tarea B3).
//
// Es una isla de React, como `LinksEditor` y `FilesUploader` de la ficha del
// cliente, y por la misma razón: aquí se edita mucho y se guarda seguido, y
// recargar la página después de cada cambio perdería el formulario que el
// operador tiene abierto. La página (`clientes/[id]/contenido/[periodo].astro`)
// entrega el estado inicial ya leído de la base y esto solo habla con la API.
//
// Tres decisiones que conviene tener a la vista:
//
// 1. **El servidor manda.** Ninguna acción cambia la lista sin que la API la
//    haya confirmado, y lo que devuelve la API es lo que se guarda en el
//    estado. Un 409 de número repetido se muestra tal cual.
// 2. **Las propuestas del modelo nunca escriben en la pieza.** «Usar esta
//    opción» llena el formulario —copy, llamado a la acción, hashtags y brief
//    visual— y ahí se queda: el operador la edita y después guarda (diseño
//    §5). Es también lo que hace la ruta, que no guarda nada.
// 3. **Los artes se guardan solos.** Subir, enlazar o quitar un arte hace su
//    propio `PATCH` en el momento, sin esperar al botón «Guardar»: el archivo
//    ya viajó al servidor y dejarlo apuntado solo en la pantalla haría que
//    cerrarla lo perdiera de vista. El resto del formulario —planeación, copy,
//    llamado a la acción, hashtags, brief visual— sí se guarda cuando el
//    operador lo dice.

import { useState } from 'react';
import {
  FORMATOS, PLATAFORMAS, cuadraConPaquete, estadoLoteSegunPiezas,
  type EstadoRevision, type Formato, type Paquete, type Plataforma,
} from '@/contenido/reglas';
import { COLOR_ESTADO } from '@/flujo/ui';
import { toast } from '@/scripts/toast';
// Solo tipos: `@/contenido/piezas` y `@/contenido/schemas` construyen esquemas
// de Zod al cargarse, y un `import type` se borra al compilar, así que la
// forma se comparte sin arrastrar Zod al navegador.
import type { Arte, TipoArte } from '@/contenido/piezas';
import type { OpcionCopy } from '@/contenido/schemas';

/** Una pieza tal como la pinta esta pantalla; es `PiezaVisible` sin las fechas de auditoría. */
export type PiezaUI = {
  id: string;
  numero: number;
  formato: Formato;
  plataforma: Plataforma;
  fechaPublicacion: string | null;
  temaId: string | null;
  copy: string;
  cta: string;
  hashtags: string;
  briefVisual: string;
  arte: Arte[];
  estadoCliente: EstadoRevision;
  notaCliente: string | null;
};

/** Los temas del mapa más reciente, agrupados por pilar y subcategoría para el `<select>`. */
export type GrupoTemas = { etiqueta: string; temas: { id: string; texto: string }[] };

/** Los archivos del cliente, para poder nombrar un arte subido en vez de mostrar su UUID. */
export type ArchivoCliente = { id: string; nombreOriginal: string };

/**
 * Espeja `MAX_ARTES` de `src/contenido/piezas.ts`. Se copia en vez de
 * importarse por lo dicho arriba (ese módulo trae Zod); el tope de verdad lo
 * aplica la API y su error se muestra tal cual si este número se quedara atrás.
 */
const MAX_ARTES = 10;

/**
 * Espeja `LIMITES.briefVisual` de `src/contenido/schemas.ts`, por lo mismo que
 * `MAX_ARTES`: es el largo con que el agente escribe el brief y con el que la
 * API lo valida, y aquí solo recorta el `<textarea>`.
 */
const MAX_BRIEF_VISUAL = 400;

/** Tipos de arte del esquema (`TIPOS_ARTE`), con su nombre visible. */
const TIPOS: { valor: TipoArte; texto: string }[] = [
  { valor: 'imagen', texto: 'Imagen' },
  { valor: 'portada', texto: 'Portada' },
  { valor: 'video', texto: 'Video' },
];

const NOMBRE_FORMATO: Record<Formato, { uno: string; varios: string }> = {
  post: { uno: 'post', varios: 'posts' },
  carrusel: { uno: 'carrusel', varios: 'carruseles' },
  reel: { uno: 'reel', varios: 'reels' },
  historia: { uno: 'historia', varios: 'historias' },
};

const NOMBRE_PLATAFORMA: Record<Plataforma, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  ambas: 'Facebook e Instagram',
};

const ETIQUETA_REVISION: Record<EstadoRevision, string> = {
  pendiente: 'Sin revisar',
  aprobada: 'Aprobada',
  cambios: 'Con cambios',
};

/**
 * El color del chip de una pieza sale del mismo `COLOR_ESTADO` que usa la
 * ficha del cliente, cruzando los dos vocabularios por donde ya están unidos:
 * `estadoLoteSegunPiezas` (src/contenido/reglas.ts) es el único puente entre
 * lo que el cliente opina de una pieza y el estado de una etapa. Con una sola
 * pieza en la lista, lo que contesta es la traducción de esa pieza: sin
 * revisar → `en_revision` (amarillo), con cambios → `con_cambios` (rosa),
 * aprobada → `aprobada` (verde). El `formato` no entra en esa decisión.
 */
function colorRevision(estado: EstadoRevision): string {
  return COLOR_ESTADO[estadoLoteSegunPiezas([{ formato: 'post', estadoCliente: estado }])];
}

const plural = (n: number, f: Formato) => `${n} ${n === 1 ? NOMBRE_FORMATO[f].uno : NOMBRE_FORMATO[f].varios}`;

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 3 });

/** Lee la respuesta de la API y devuelve o los datos o el texto del error, ya juntado. */
async function pedir(url: string, init: RequestInit): Promise<{ ok: true; cuerpo: any } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, init);
    const cuerpo = await res.json();
    if (cuerpo?.ok) return { ok: true, cuerpo };
    return { ok: false, error: (cuerpo?.errores ?? ['No se pudo completar la operación.']).join(' · ') };
  } catch {
    return { ok: false, error: 'No se pudo contactar al servidor.' };
  }
}

// ── Cabecera: cifras por formato y aviso de cuadre ──────────────────────

function Cifras({ piezas, paquete }: { piezas: PiezaUI[]; paquete: Paquete }) {
  const sinPaquete = Object.keys(paquete).length === 0;
  // Avisa, no bloquea (diseño §3): el aviso se ve, y nada de lo que hay abajo
  // se deshabilita por él.
  const diferencias = sinPaquete ? [] : cuadraConPaquete(piezas, paquete);

  return (
    <section className="tarjeta">
      <h2>El mes en números</h2>
      <p className="sub">
        {piezas.length === 0 ? 'Todavía no hay piezas.' : `${piezas.length} ${piezas.length === 1 ? 'pieza' : 'piezas'} en el lote.`}
      </p>

      <div className="indicadores">
        {FORMATOS.map((f) => {
          const hay = piezas.filter((p) => p.formato === f).length;
          const esperadas = paquete[f];
          return (
            <div className="indicador" key={f}>
              <span className="valor cifra">{hay}</span>
              <span className="nombre">{NOMBRE_FORMATO[f].varios}</span>
              {esperadas !== undefined && <span className="secundario">Paquete: {esperadas}</span>}
            </div>
          );
        })}
      </div>

      {sinPaquete ? (
        <p className="aviso" style={{ marginTop: 16 }}>
          Este cliente no tiene paquete definido, así que no hay con qué comparar el mes. Se puede armar el lote igual.
        </p>
      ) : diferencias.length === 0 ? (
        <p className="aviso verde" style={{ marginTop: 16 }}>El mes cuadra con el paquete contratado.</p>
      ) : (
        <p className="aviso amarillo" style={{ marginTop: 16 }} role="status">
          {diferencias
            .map((d) => (d.faltan > 0 ? `faltan ${plural(d.faltan, d.formato)}` : `sobran ${plural(-d.faltan, d.formato)}`))
            .join(' · ')}
          . Es un recordatorio: el mes se puede cerrar así.
        </p>
      )}
    </section>
  );
}

// ── Artes de una pieza ──────────────────────────────────────────────────

function Artes({
  pieza, clientId, archivos, operable, onCambio, onArchivo,
}: {
  pieza: PiezaUI;
  clientId: string;
  archivos: ArchivoCliente[];
  operable: boolean;
  onCambio: (arte: Arte[]) => Promise<boolean>;
  onArchivo: (a: ArchivoCliente) => void;
}) {
  const [tipoSubida, setTipoSubida] = useState<TipoArte>('imagen');
  const [tipoEnlace, setTipoEnlace] = useState<TipoArte>('video');
  const [url, setUrl] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lleno = pieza.arte.length >= MAX_ARTES;
  const nombreDe = (fileId: string) => archivos.find((a) => a.id === fileId)?.nombreOriginal ?? 'Archivo subido';

  async function subir(archivo: File) {
    setError(null);
    setSubiendo(true);
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo);
    // El mismo `POST /api/clientes/[id]/files` que usa la ficha del cliente
    // (`FilesUploader`): un solo sistema de archivos para todo el Studio.
    const r = await pedir(`/api/clientes/${clientId}/files`, { method: 'POST', body: cuerpo });
    if (!r.ok) {
      setError(r.error);
      setSubiendo(false);
      return;
    }
    onArchivo(r.cuerpo.archivo);
    const guardado = await onCambio([...pieza.arte, { tipo: tipoSubida, fileId: r.cuerpo.archivo.id }]);
    if (!guardado) setError('El archivo se subió, pero no se pudo asociar a la pieza.');
    setSubiendo(false);
  }

  async function agregarEnlace() {
    setError(null);
    if (!url.trim()) return;
    const ok = await onCambio([...pieza.arte, { tipo: tipoEnlace, url: url.trim() }]);
    if (ok) setUrl('');
  }

  return (
    <div className="pieza-artes">
      <h4>Artes</h4>
      {pieza.arte.length === 0 ? (
        <p className="secundario">Sin artes todavía.</p>
      ) : (
        <ul className="lista-archivos">
          {pieza.arte.map((a, i) => (
            <li key={`${a.fileId ?? a.url}-${i}`}>
              <span className="etiqueta marca">{TIPOS.find((t) => t.valor === a.tipo)?.texto ?? a.tipo}</span>
              {a.url ? (
                <a className="nombre" href={a.url} target="_blank" rel="noreferrer noopener">{a.url}</a>
              ) : (
                <span className="nombre">{nombreDe(a.fileId!)}</span>
              )}
              {operable && (
                <button
                  type="button"
                  className="btn fantasma chico"
                  onClick={() => void onCambio(pieza.arte.filter((_, j) => j !== i))}
                  aria-label={`Quitar el arte ${i + 1} de la pieza ${pieza.numero}`}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {operable && (
        <>
          <div className="agregar">
            <div className="campo">
              <label htmlFor={`tipo-subida-${pieza.id}`}>Tipo</label>
              <select id={`tipo-subida-${pieza.id}`} value={tipoSubida} onChange={(e) => setTipoSubida(e.target.value as TipoArte)}>
                {TIPOS.filter((t) => t.valor !== 'video').map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
              </select>
            </div>
            <div className="campo crece">
              <label htmlFor={`subir-${pieza.id}`}>Subir arte</label>
              <input
                id={`subir-${pieza.id}`}
                type="file"
                accept=".png,.jpg,.jpeg"
                disabled={subiendo || lleno}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void subir(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <p className="ayuda">
            PNG o JPEG, máximo 25 MB. El video del reel va como enlace: el almacén de archivos del Studio no acepta video.
          </p>

          <div className="agregar">
            <div className="campo">
              <label htmlFor={`tipo-enlace-${pieza.id}`}>Tipo</label>
              <select id={`tipo-enlace-${pieza.id}`} value={tipoEnlace} onChange={(e) => setTipoEnlace(e.target.value as TipoArte)}>
                {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
              </select>
            </div>
            <div className="campo crece">
              <label htmlFor={`enlace-${pieza.id}`}>Enlace del arte</label>
              <input id={`enlace-${pieza.id}`} type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <button type="button" className="btn fantasma" disabled={lleno || !url.trim()} onClick={() => void agregarEnlace()}>
              Agregar enlace
            </button>
          </div>

          {subiendo && <p className="secundario">Subiendo…</p>}
          {lleno && <p className="ayuda">Una pieza no lleva más de {MAX_ARTES} artes.</p>}
          {error && <p className="aviso rosa" role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}

// ── Propuestas de copy ──────────────────────────────────────────────────

function Propuestas({ opciones, costo, onUsar }: { opciones: OpcionCopy[]; costo: number | null; onUsar: (o: OpcionCopy) => void }) {
  return (
    <div className="propuestas">
      <h4>Tres caminos para este tema</h4>
      <p className="ayuda">
        Elegir una la copia al formulario para que la edites. Nada se guarda hasta que le des a «Guardar la pieza».
        {costo !== null && ` Costó ${dinero(costo)}.`}
      </p>
      {opciones.map((o, i) => (
        <article className="propuesta" key={i}>
          <strong>{o.gancho}</strong>
          <p className="propuesta-copy">{o.copy}</p>
          <p className="secundario"><b>Llamado:</b> {o.cta}</p>
          <p className="secundario">{o.hashtags.join(' ')}</p>
          <p className="secundario"><b>Brief visual:</b> {o.briefVisual}</p>
          <button type="button" className="btn chico" onClick={() => onUsar(o)}>Usar esta opción</button>
        </article>
      ))}
      <p className="ayuda">
        El brief visual es para quien haga el arte: al elegir una opción se copia al formulario con el resto del texto y se guarda con la pieza.
      </p>
    </div>
  );
}

// ── Una pieza ───────────────────────────────────────────────────────────

type Borrador = {
  numero: string;
  formato: Formato;
  plataforma: Plataforma;
  fechaPublicacion: string;
  temaId: string;
  copy: string;
  cta: string;
  hashtags: string;
  briefVisual: string;
};

const aBorrador = (p: PiezaUI): Borrador => ({
  numero: String(p.numero),
  formato: p.formato,
  plataforma: p.plataforma,
  fechaPublicacion: p.fechaPublicacion ?? '',
  temaId: p.temaId ?? '',
  copy: p.copy,
  cta: p.cta,
  hashtags: p.hashtags,
  briefVisual: p.briefVisual,
});

function TarjetaPieza({
  pieza, clientId, grupos, archivos, operable, abierta, onAbrir, onGuardada, onBorrada, onArchivo,
}: {
  pieza: PiezaUI;
  clientId: string;
  grupos: GrupoTemas[];
  archivos: ArchivoCliente[];
  operable: boolean;
  abierta: boolean;
  onAbrir: () => void;
  onGuardada: (p: PiezaUI) => void;
  onBorrada: () => void;
  onArchivo: (a: ArchivoCliente) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(() => aBorrador(pieza));
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [opciones, setOpciones] = useState<OpcionCopy[] | null>(null);
  const [costo, setCosto] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const campo = (k: keyof Borrador) => `${k}-${pieza.id}`;
  const cambiar = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setBorrador((b) => ({ ...b, [k]: v }));

  async function guardar() {
    setError(null);
    setOcupado(true);
    const numero = Number(borrador.numero);
    const r = await pedir(`/api/contenido/piezas/${pieza.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // El número se manda solo si es un entero: un campo vaciado a mano no
        // debe convertirse en un 0 que la API rechace con un mensaje raro.
        ...(Number.isInteger(numero) && numero > 0 ? { numero } : {}),
        formato: borrador.formato,
        plataforma: borrador.plataforma,
        fechaPublicacion: borrador.fechaPublicacion || null,
        temaId: borrador.temaId || null,
        copy: borrador.copy,
        cta: borrador.cta,
        hashtags: borrador.hashtags,
        briefVisual: borrador.briefVisual,
      }),
    });
    setOcupado(false);
    if (!r.ok) { setError(r.error); return; }
    onGuardada({ ...pieza, ...r.cuerpo.pieza });
    toast('Pieza guardada');
  }

  /** Guarda solo los artes; se llama al subir, enlazar o quitar uno. */
  async function guardarArtes(arte: Arte[]): Promise<boolean> {
    const r = await pedir(`/api/contenido/piezas/${pieza.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arte }),
    });
    if (!r.ok) { setError(r.error); return false; }
    onGuardada({ ...pieza, ...r.cuerpo.pieza });
    return true;
  }

  async function borrar() {
    setOcupado(true);
    const r = await pedir(`/api/contenido/piezas/${pieza.id}`, { method: 'DELETE' });
    setOcupado(false);
    if (!r.ok) { setError(r.error); setConfirmando(false); return; }
    onBorrada();
    toast('Pieza borrada');
  }

  async function proponer() {
    setError(null);
    setGenerando(true);
    // Se manda el tema que está elegido en el formulario, aunque todavía no se
    // haya guardado: pedir ideas no debería obligar a guardar primero. La ruta
    // acepta `temaId` justo para esto.
    const r = await pedir(`/api/contenido/piezas/${pieza.id}/propuestas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temaId: borrador.temaId || null }),
    });
    setGenerando(false);
    if (!r.ok) { setError(r.error); return; }
    setOpciones(r.cuerpo.opciones);
    setCosto(typeof r.cuerpo.costoUsd === 'number' ? r.cuerpo.costoUsd : null);
    if (r.cuerpo.topeAlcanzado) toast('Se alcanzó el tope de gasto de esta petición.', 'error');
  }

  function usar(o: OpcionCopy) {
    setBorrador((b) => ({ ...b, copy: o.copy, cta: o.cta, hashtags: o.hashtags.join(' '), briefVisual: o.briefVisual }));
    toast('Opción copiada al formulario. Edítala y guarda.');
  }

  const resumen = [
    NOMBRE_FORMATO[pieza.formato].uno,
    NOMBRE_PLATAFORMA[pieza.plataforma],
    pieza.fechaPublicacion ?? 'sin fecha',
  ].join(' · ');

  return (
    <article className="pieza">
      <button type="button" className="pieza-cabeza" onClick={onAbrir} aria-expanded={abierta} aria-controls={`cuerpo-${pieza.id}`}>
        <span className="pieza-numero cifra">{pieza.numero}</span>
        <span className="pieza-resumen">
          <strong>{resumen}</strong>
          <span className="secundario">{pieza.copy ? pieza.copy.slice(0, 80) : 'Sin copy'}</span>
        </span>
        <span className={`etiqueta ${colorRevision(pieza.estadoCliente)}`}>{ETIQUETA_REVISION[pieza.estadoCliente]}</span>
      </button>

      {abierta && (
        <div className="pieza-cuerpo" id={`cuerpo-${pieza.id}`}>
          {pieza.notaCliente && (
            <p className="aviso amarillo"><b>El cliente pidió cambios:</b> {pieza.notaCliente}</p>
          )}

          <div className="campos">
            <div className="campo">
              <label htmlFor={campo('numero')}>Número</label>
              <input id={campo('numero')} type="number" min={1} max={999} inputMode="numeric"
                value={borrador.numero} disabled={!operable} onChange={(e) => cambiar('numero', e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor={campo('fechaPublicacion')}>Fecha de publicación</label>
              <input id={campo('fechaPublicacion')} type="date" value={borrador.fechaPublicacion}
                disabled={!operable} onChange={(e) => cambiar('fechaPublicacion', e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor={campo('formato')}>Formato</label>
              <select id={campo('formato')} value={borrador.formato} disabled={!operable}
                onChange={(e) => cambiar('formato', e.target.value as Formato)}>
                {FORMATOS.map((f) => <option key={f} value={f}>{NOMBRE_FORMATO[f].uno}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor={campo('plataforma')}>Plataforma</label>
              <select id={campo('plataforma')} value={borrador.plataforma} disabled={!operable}
                onChange={(e) => cambiar('plataforma', e.target.value as Plataforma)}>
                {PLATAFORMAS.map((p) => <option key={p} value={p}>{NOMBRE_PLATAFORMA[p]}</option>)}
              </select>
            </div>
            <div className="campo ancho">
              <label htmlFor={campo('temaId')}>Tema del mapa de pilares</label>
              <select id={campo('temaId')} value={borrador.temaId} disabled={!operable || grupos.length === 0}
                onChange={(e) => cambiar('temaId', e.target.value)}>
                <option value="">Sin tema</option>
                {grupos.map((g) => (
                  <optgroup label={g.etiqueta} key={g.etiqueta}>
                    {g.temas.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.texto}</option>)}
                  </optgroup>
                ))}
                {/* El mapa se puede regenerar: un tema guardado con una versión
                    anterior ya no está en la lista, y el <select> lo perdería en
                    silencio al guardar. Se le hace su propia opción. */}
                {borrador.temaId && !grupos.some((g) => g.temas.some((t) => t.id === borrador.temaId)) && (
                  <option value={borrador.temaId}>{borrador.temaId} · de una versión anterior del mapa</option>
                )}
              </select>
              {grupos.length === 0 && <p className="ayuda">Este cliente todavía no tiene mapa de pilares.</p>}
            </div>
            <div className="campo ancho">
              <label htmlFor={campo('copy')}>Copy</label>
              <textarea id={campo('copy')} rows={8} maxLength={2200} value={borrador.copy}
                disabled={!operable} onChange={(e) => cambiar('copy', e.target.value)} />
              <p className="ayuda">{borrador.copy.length} de 2200 caracteres.</p>
            </div>
            <div className="campo ancho">
              <label htmlFor={campo('cta')}>Llamado a la acción</label>
              <input id={campo('cta')} type="text" maxLength={120} value={borrador.cta}
                disabled={!operable} onChange={(e) => cambiar('cta', e.target.value)} />
            </div>
            <div className="campo ancho">
              <label htmlFor={campo('hashtags')}>Hashtags</label>
              <input id={campo('hashtags')} type="text" maxLength={600} value={borrador.hashtags}
                disabled={!operable} onChange={(e) => cambiar('hashtags', e.target.value)} />
            </div>
            <div className="campo ancho">
              <label htmlFor={campo('briefVisual')}>Brief visual</label>
              <textarea id={campo('briefVisual')} rows={3} maxLength={MAX_BRIEF_VISUAL} value={borrador.briefVisual}
                disabled={!operable} onChange={(e) => cambiar('briefVisual', e.target.value)} />
              <p className="ayuda">La indicación para quien haga el arte. No se publica: {borrador.briefVisual.length} de {MAX_BRIEF_VISUAL} caracteres.</p>
            </div>
          </div>

          <Artes
            pieza={pieza} clientId={clientId} archivos={archivos} operable={operable}
            onCambio={guardarArtes} onArchivo={onArchivo}
          />

          {opciones && <Propuestas opciones={opciones} costo={costo} onUsar={usar} />}

          {error && <p className="aviso rosa" role="alert">{error}</p>}

          {operable && (
            <div className="acciones">
              <button type="button" className="btn" onClick={() => void guardar()} disabled={ocupado}>
                {ocupado ? 'Guardando…' : 'Guardar la pieza'}
              </button>
              <button type="button" className="btn fantasma" onClick={() => void proponer()} disabled={generando || !borrador.temaId}>
                {generando ? 'Pidiendo propuestas…' : 'Pedir propuestas de copy'}
              </button>
              {confirmando ? (
                <>
                  <span className="secundario">¿Borrar la pieza {pieza.numero}?</span>
                  <button type="button" className="btn peligro lleno chico" onClick={() => void borrar()} disabled={ocupado}>Sí, borrar</button>
                  <button type="button" className="btn fantasma chico" onClick={() => setConfirmando(false)}>Cancelar</button>
                </>
              ) : (
                <button type="button" className="btn peligro" onClick={() => setConfirmando(true)}>Borrar</button>
              )}
            </div>
          )}
          {!borrador.temaId && operable && (
            <p className="ayuda">Para pedir propuestas hace falta elegir antes un tema del mapa: el copy sale de ahí.</p>
          )}
        </div>
      )}
    </article>
  );
}

// ── La pantalla ─────────────────────────────────────────────────────────

export default function PiezasEditor({
  clientId, loteId, paquete, grupos, operable,
  piezas: iniciales, archivos: archivosIniciales,
}: {
  clientId: string;
  loteId: string;
  paquete: Paquete;
  grupos: GrupoTemas[];
  operable: boolean;
  piezas: PiezaUI[];
  archivos: ArchivoCliente[];
}) {
  const [piezas, setPiezas] = useState<PiezaUI[]>(iniciales);
  const [archivos, setArchivos] = useState<ArchivoCliente[]>(archivosIniciales);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [formato, setFormato] = useState<Formato>('post');
  const [plataforma, setPlataforma] = useState<Plataforma>('ambas');
  const [fecha, setFecha] = useState('');
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Por número, que es el orden en que el cliente ve el mes; la API lo asigna
  // sola al dar de alta, pero el operador puede renumerar al planear.
  const ordenadas = [...piezas].sort((a, b) => a.numero - b.numero);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAlta(true);
    const r = await pedir(`/api/contenido/lotes/${loteId}/piezas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formato, plataforma, fechaPublicacion: fecha || null }),
    });
    setAlta(false);
    if (!r.ok) { setError(r.error); return; }
    const pieza: PiezaUI = r.cuerpo.pieza;
    setPiezas((p) => [...p, pieza]);
    setAbierta(pieza.id);
    setFecha('');
    toast(`Pieza ${pieza.numero} agregada`);
  }

  return (
    <>
      <Cifras piezas={piezas} paquete={paquete} />

      <section className="tarjeta">
        <h2>Piezas del mes</h2>
        <p className="sub">
          {operable
            ? 'Cada pieza guarda su planeación, su arte y su texto. Los artes se guardan al subirlos; lo demás, con «Guardar la pieza».'
            : 'Solo lectura: este cliente no es tuyo.'}
        </p>

        {ordenadas.length === 0 ? (
          <p className="secundario">Todavía no hay piezas. Agrega la primera aquí abajo.</p>
        ) : (
          <div className="piezas">
            {ordenadas.map((p) => (
              <TarjetaPieza
                key={p.id}
                pieza={p}
                clientId={clientId}
                grupos={grupos}
                archivos={archivos}
                operable={operable}
                abierta={abierta === p.id}
                onAbrir={() => setAbierta((a) => (a === p.id ? null : p.id))}
                onGuardada={(nueva) => setPiezas((lista) => lista.map((x) => (x.id === nueva.id ? nueva : x)))}
                onBorrada={() => { setPiezas((lista) => lista.filter((x) => x.id !== p.id)); setAbierta(null); }}
                onArchivo={(a) => setArchivos((lista) => [...lista, a])}
              />
            ))}
          </div>
        )}
      </section>

      {operable && (
        <section className="tarjeta">
          <h2>Agregar una pieza</h2>
          <p className="sub">El número se asigna solo: el siguiente libre del mes.</p>
          <form onSubmit={agregar}>
            <div className="agregar">
              <div className="campo">
                <label htmlFor="alta-formato">Formato</label>
                <select id="alta-formato" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
                  {FORMATOS.map((f) => <option key={f} value={f}>{NOMBRE_FORMATO[f].uno}</option>)}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="alta-plataforma">Plataforma</label>
                <select id="alta-plataforma" value={plataforma} onChange={(e) => setPlataforma(e.target.value as Plataforma)}>
                  {PLATAFORMAS.map((p) => <option key={p} value={p}>{NOMBRE_PLATAFORMA[p]}</option>)}
                </select>
              </div>
              <div className="campo crece">
                <label htmlFor="alta-fecha">Fecha de publicación</label>
                <input id="alta-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <button type="submit" className="btn" disabled={alta}>{alta ? 'Agregando…' : 'Agregar pieza'}</button>
            </div>
          </form>
          {error && <p className="aviso rosa" role="alert" style={{ marginTop: 16 }}>{error}</p>}
        </section>
      )}
    </>
  );
}
