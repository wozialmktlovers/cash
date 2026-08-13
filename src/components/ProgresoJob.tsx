import { useEffect, useState } from 'react';

type Estado = {
  ok: boolean;
  estado: string;
  etapaActual: string | null;
  etapas: Record<string, string>;
  costoUsd: number;
  error: string | null;
  resultId: string | null;
};

const ETAPAS = [
  { clave: 'competencia', titulo: 'Competencia', detalle: 'Precios, competidores directos e indirectos, referentes.' },
  { clave: 'audiencia', titulo: 'Audiencia', detalle: 'Jerga, dolores, aspiraciones y dos personas contrastantes.' },
  { clave: 'canales', titulo: 'Canales', detalle: 'Plataformas, formatos, horarios y advertencias regulatorias.' },
  { clave: 'mercado', titulo: 'Mercado', detalle: 'Datos oficiales, salarios, regulación y crecimiento.' },
  { clave: 'sintesis', titulo: 'Síntesis', detalle: 'Decisiones estratégicas. Espera a las cuatro anteriores.' },
];

const ETIQUETA: Record<string, { texto: string; clase: string }> = {
  ok: { texto: 'Lista', clase: 'completado' },
  corriendo: { texto: 'Corriendo', clase: 'corriendo' },
  fallo: { texto: 'Falló', clase: 'fallido' },
  omitido_por_costo: { texto: 'Omitida por costo', clase: 'cancelado' },
};

const dinero = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function ProgresoJob({ jobId, inicial }: { jobId: string; inicial: Estado }) {
  const [estado, setEstado] = useState<Estado>(inicial);
  const [error, setError] = useState<string | null>(null);

  const terminado = estado.estado === 'completado' || estado.estado === 'fallido' || estado.estado === 'cancelado';

  useEffect(() => {
    if (terminado) return;

    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const cuerpo = await res.json();
        if (cuerpo.ok) {
          setEstado(cuerpo);
          setError(null);
        }
      } catch {
        setError('Se perdió la conexión con el servidor. Reintentando…');
      }
    }, 3000);

    return () => clearInterval(t);
  }, [jobId, terminado]);

  return (
    <div>
      <div className="resumen">
        <span className={`etiqueta ${estado.estado}`}>{estado.estado}</span>
        <span className="secundario">Costo acumulado: {dinero(estado.costoUsd)}</span>
      </div>

      {error && <p className="aviso amarillo" style={{ marginTop: 16 }}>{error}</p>}

      {estado.error && (
        <p className="aviso rosa" style={{ marginTop: 16 }}>{estado.error}</p>
      )}

      <ul className="etapas">
        {ETAPAS.map((e) => {
          const s = estado.etapas?.[e.clave];
          const et = s ? ETIQUETA[s] : null;
          return (
            <li key={e.clave} className={s === 'corriendo' ? 'activa' : ''}>
              <div className="cabeza">
                <strong>{e.titulo}</strong>
                <span className={`etiqueta ${et?.clase ?? ''}`}>
                  {et?.texto ?? 'En espera'}
                </span>
              </div>
              <p className="ayuda">{e.detalle}</p>
            </li>
          );
        })}
      </ul>

      {terminado && estado.resultId && (
        <div className="acciones">
          <a href={`/resultados/${estado.resultId}`} className="btn">Ver la presentación</a>
        </div>
      )}

      {terminado && !estado.resultId && (
        <p className="aviso amarillo" style={{ marginTop: 22 }}>
          La investigación terminó sin producir un resultado que mostrar.
        </p>
      )}
    </div>
  );
}
