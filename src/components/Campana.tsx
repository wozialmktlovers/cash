import { useCallback, useEffect, useRef, useState } from 'react';

type Item = { id: string; titulo: string; texto: string; enlace: string | null; leidaEn: string | null; creadoEn: string };

/**
 * Campana de avisos en la barra superior (spec §3, Avisos). Isla `client:load`
 * en `Base.astro`: consulta el conteo al montar y cada 60 s (solo mientras la
 * pestaña está visible), y la lista completa cada vez que se abre.
 */
export default function Campana() {
  const [abierto, setAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<Item[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const cargarConteo = useCallback(async () => {
    try {
      const r = await fetch('/api/notificaciones');
      if (!r.ok) return;
      const cuerpo = await r.json();
      setNoLeidas(cuerpo.noLeidas ?? 0);
    } catch {
      // Sondeo de fondo: un fallo de red aquí no debe interrumpir nada, ya se reintenta en 60 s.
    }
  }, []);

  useEffect(() => {
    void cargarConteo();
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') void cargarConteo();
    }, 60_000);
    return () => clearInterval(intervalo);
  }, [cargarConteo]);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      const r = await fetch('/api/notificaciones');
      if (!r.ok) throw new Error(String(r.status));
      const cuerpo = await r.json();
      setItems(cuerpo.items ?? []);
      setNoLeidas(cuerpo.noLeidas ?? 0);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  const cerrar = useCallback(() => {
    setAbierto(false);
    boton.current?.focus();
  }, []);

  useEffect(() => {
    if (!abierto) return;
    void cargarLista();
  }, [abierto, cargarLista]);

  useEffect(() => {
    if (!abierto) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar();
      }
    };
    const clic = (e: MouseEvent) => {
      const objetivo = e.target as Node;
      if (panel.current?.contains(objetivo) || boton.current?.contains(objetivo)) return;
      setAbierto(false);
    };

    document.addEventListener('keydown', tecla);
    document.addEventListener('mousedown', clic);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('mousedown', clic);
    };
  }, [abierto, cerrar]);

  const marcarLeidas = useCallback(async (ids?: string[]) => {
    try {
      await fetch('/api/notificaciones/leer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      });
    } catch {
      // Si falla, el próximo sondeo (60 s, o al reabrir) corrige el contador.
    }
  }, []);

  const marcarTodas = () => {
    const ahora = new Date().toISOString();
    setItems((prev) => prev?.map((i) => ({ ...i, leidaEn: i.leidaEn ?? ahora })) ?? prev);
    setNoLeidas(0);
    void marcarLeidas();
  };

  const abrirAviso = (item: Item) => {
    if (!item.leidaEn) {
      const ahora = new Date().toISOString();
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, leidaEn: ahora } : i)) ?? prev);
      setNoLeidas((n) => Math.max(0, n - 1));
      void marcarLeidas([item.id]);
    }
    if (item.enlace) window.location.href = item.enlace;
  };

  return (
    <div className="campana">
      <button
        ref={boton}
        type="button"
        className="icono-btn campana-boton"
        aria-expanded={abierto}
        aria-controls="campana-panel"
        aria-label={noLeidas > 0 ? `Avisos, ${noLeidas} sin leer` : 'Avisos'}
        onClick={() => setAbierto((a) => !a)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {noLeidas > 0 && <span className="campana-contador" aria-hidden="true">{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>

      {abierto && (
        <div ref={panel} id="campana-panel" className="campana-panel" role="dialog" aria-label="Avisos">
          <div className="campana-encabezado">
            <strong>Avisos</strong>
            {noLeidas > 0 && (
              <button type="button" className="campana-marcar" onClick={marcarTodas}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          {cargando && <p className="nota">Cargando…</p>}
          {!cargando && error && <p className="nota">No se pudieron cargar los avisos.</p>}
          {!cargando && !error && (items?.length ?? 0) === 0 && <p className="nota">No tienes avisos.</p>}
          {!cargando && !error && items && items.length > 0 && (
            <ul className="campana-lista">
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" className="campana-item" data-leida={Boolean(item.leidaEn)} onClick={() => abrirAviso(item)}>
                    <span className="campana-titulo">{item.titulo}</span>
                    <span className="campana-texto">{item.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
