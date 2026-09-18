import { useEffect, useState } from 'react';
import { etapasDe, porcentaje, transcurrido, ETIQUETA_ESTADO, ETIQUETA_ETAPA } from '@/lib/ui/progreso';

type Estado = {
  ok: boolean;
  estado: string;
  etapaActual: string | null;
  etapas: Record<string, string>;
  costoUsd: number;
  error: string | null;
  resultId: string | null;
  /** Solo el mes con IA: la pantalla del mes, que es su destino (no tiene vista por id). */
  enlace?: string | null;
  tipo?: 'research' | 'growth' | 'pilares' | 'contenido';
  startedAt: string | null;
  finishedAt: string | null;
};

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

// El destino final y su texto según el tipo de job. `research` es el valor
// por omisión: los jobs viejos no traían `tipo`.
const DESTINO: Record<'research' | 'growth' | 'pilares' | 'contenido', { href: (id: string, enlace?: string | null) => string; texto: string }> = {
  research: { href: (id) => `/resultados/${id}`, texto: 'Ver la presentación' },
  growth: { href: (id) => `/growth/${id}`, texto: 'Ver el manual de campaña' },
  pilares: { href: (id) => `/pilares/${id}`, texto: 'Ver el mapa de pilares' },
  contenido: { href: (_id, enlace) => enlace ?? '/', texto: 'Ver las piezas del mes' },
};

const TRAZO: Record<string, string> = {
  ok: 'm5 12.5 4.5 4.5L19 7',
  fallo: 'M6 6l12 12M18 6 6 18',
  omitido_por_costo: 'M5 12h14',
  abortado: 'M5 12h14',
  corriendo: 'M12 7v5l3 2',
};

function MarcaEtapa({ estado }: { estado?: string }) {
  const d = estado ? TRAZO[estado] : undefined;
  return (
    <span className="marca-etapa" aria-hidden="true">
      {d && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
      )}
    </span>
  );
}

export default function ProgresoJob({ jobId, inicial, tope }: { jobId: string; inicial: Estado; tope: number }) {
  const [estado, setEstado] = useState<Estado>(inicial);
  const [conexion, setConexion] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => new Date());

  const terminado = ['completado', 'fallido', 'cancelado'].includes(estado.estado);

  useEffect(() => {
    if (terminado) return;
    const consulta = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const cuerpo = await res.json();
        if (cuerpo.ok) { setEstado(cuerpo); setConexion(null); }
      } catch {
        setConexion('Se perdió la conexión con el servidor. Reintentando…');
      }
    }, 3000);
    const reloj = setInterval(() => setAhora(new Date()), 1000);
    return () => { clearInterval(consulta); clearInterval(reloj); };
  }, [jobId, terminado]);

  const etapas = etapasDe(estado.tipo);
  // Solo un job completado llena la barra al 100%. Si falló o se canceló a
  // medio camino, se muestra el avance real (las etapas que sí terminaron
  // ok) para no aparentar que el trabajo llegó al final.
  const pct = estado.estado === 'completado' ? 100 : porcentaje(estado.etapas ?? {}, estado.tipo);
  const tiempo = transcurrido(estado.startedAt, estado.finishedAt ? new Date(estado.finishedAt) : ahora);
  const destino = DESTINO[estado.tipo ?? 'research'];

  return (
    <div>
      <section className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`etiqueta ${estado.estado}`}>{ETIQUETA_ESTADO[estado.estado] ?? estado.estado}</span>
          <span className="secundario cifra">{tiempo ?? 'En cola'}</span>
        </div>
        <p className="display cifra" style={{ margin: '14px 0 10px' }}>{pct}%</p>
        <div className="avance" role="progressbar" aria-label="Avance del trabajo" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="secundario cifra" style={{ marginTop: 10 }}>
          {dinero(estado.costoUsd)} de {dinero(tope)} de tope
        </p>
        {conexion && <p className="aviso amarillo" style={{ marginTop: 14 }}>{conexion}</p>}
        {estado.error && <p className="aviso rosa" role="alert" style={{ marginTop: 14 }}>{estado.error}</p>}
      </section>

      <section className="tarjeta">
        <h2>Etapas</h2>
        <ol className="linea-tiempo">
          {etapas.map((e) => {
            const s = estado.etapas?.[e.clave];
            return (
              <li key={e.clave} className={s ?? ''} aria-current={s === 'corriendo' ? 'step' : undefined}>
                <MarcaEtapa estado={s} />
                <div>
                  <strong>{e.titulo}</strong>
                  <span className="secundario"> · {s ? ETIQUETA_ETAPA[s] ?? s : 'En espera'}</span>
                  <p className="ayuda" style={{ marginTop: 2 }}>{e.detalle}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {terminado && estado.resultId && (
        <a href={destino.href(estado.resultId, estado.enlace)} className="btn ancho-total" style={{ marginTop: 18 }}>
          {destino.texto}
        </a>
      )}
      {terminado && !estado.resultId && (
        <p className="aviso amarillo" style={{ marginTop: 18 }}>El trabajo terminó sin producir un resultado que mostrar.</p>
      )}
      {terminado && !estado.resultId && estado.tipo === 'contenido' && estado.enlace && (
        <a href={estado.enlace} className="btn fantasma ancho-total" style={{ marginTop: 12 }}>Volver al mes</a>
      )}
    </div>
  );
}
