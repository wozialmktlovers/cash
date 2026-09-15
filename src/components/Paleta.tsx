import { useEffect, useMemo, useRef, useState } from 'react';
import { coincide } from '@/lib/ui/buscar';
import { iniciales, tinte } from '@/lib/ui/cliente-visual';
import type { ResumenCliente } from '@/lib/clientes';

type Item =
  | { tipo: 'cliente'; id: string; c: ResumenCliente; href: string }
  | { tipo: 'accion'; id: string; texto: string; href: string };

const ACCIONES: Item[] = [
  { tipo: 'accion', id: 'nuevo', texto: 'Nuevo cliente', href: '/clientes/nuevo' },
  { tipo: 'accion', id: 'entregables', texto: 'Ver entregables', href: '/entregables' },
];

export default function Paleta() {
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState('');
  const [clientes, setClientes] = useState<ResumenCliente[] | null>(null);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const previo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierta((a) => !a);
      }
    };
    const clic = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-abrir-paleta]')) {
        e.preventDefault();
        setAbierta(true);
      }
    };
    document.addEventListener('keydown', tecla);
    document.addEventListener('click', clic);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('click', clic);
    };
  }, []);

  useEffect(() => {
    if (!abierta) return;
    previo.current = document.activeElement as HTMLElement | null;
    setQ('');
    setSel(0);
    entrada.current?.focus();
    // La lista se pide la primera vez que se abre y se reutiliza después.
    if (clientes === null) {
      setError(false);
      fetch('/api/clientes')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((cuerpo) => setClientes(cuerpo.clientes))
        .catch(() => setError(true));
    }
    return () => previo.current?.focus();
  }, [abierta]);

  const items = useMemo<Item[]>(() => {
    const deClientes: Item[] = (clientes ?? [])
      .filter((c) => coincide(q, [c.nombre, c.giro, c.ciudad]))
      .slice(0, 8)
      .map((c) => ({ tipo: 'cliente', id: c.id, c, href: `/clientes/${c.id}` }));
    const acciones = ACCIONES.filter((a) => a.tipo === 'accion' && coincide(q, [a.texto]));
    return [...deClientes, ...acciones];
  }, [clientes, q]);

  useEffect(() => setSel(0), [q]);

  if (!abierta) return null;

  const cerrar = () => setAbierta(false);
  const ir = (item: Item | undefined) => { if (item) window.location.href = item.href; };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); ir(items[sel]); }
  };

  const cargando = clientes === null && !error;

  return (
    <div className="paleta-fondo" onClick={cerrar}>
      <div className="paleta" role="dialog" aria-modal="true" aria-label="Buscar" onClick={(e) => e.stopPropagation()}>
        <input
          ref={entrada}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={teclas}
          placeholder="Busca por nombre, giro o ciudad…"
          role="combobox"
          aria-expanded="true"
          aria-controls="paleta-lista"
          aria-activedescendant={items[sel] ? `paleta-${items[sel].id}` : undefined}
        />
        <ul id="paleta-lista" role="listbox">
          {cargando && [0, 1, 2].map((i) => (
            <li key={i} aria-hidden="true"><div className="esqueleto" style={{ width: `${70 - i * 15}%` }} /></li>
          ))}
          {error && <li className="nota" role="presentation">No se pudo cargar la lista</li>}
          {!cargando && !error && items.every((i) => i.tipo === 'accion') && q && (
            <li className="nota" role="presentation">Ningún cliente coincide</li>
          )}
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`paleta-${item.id}`}
              role="option"
              aria-selected={i === sel}
              onMouseEnter={() => setSel(i)}
              onClick={() => ir(item)}
            >
              {item.tipo === 'cliente' ? (
                <>
                  <span className={`avatar ${tinte(item.c.id)}`}>{iniciales(item.c.nombre)}</span>
                  <span>
                    <strong>{item.c.nombre}</strong>
                    <span className="secundario" style={{ display: 'block' }}>
                      {item.c.giro}{item.c.ciudad ? ` · ${item.c.ciudad}` : ''}
                    </span>
                  </span>
                </>
              ) : (
                <span>{item.texto}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
