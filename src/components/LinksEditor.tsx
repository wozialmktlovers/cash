import { useState } from 'react';

export type Enlace = {
  id: string;
  clientId: string;
  tipo: string;
  url: string;
};

const TIPOS = ['sitio', 'instagram', 'facebook', 'tiktok', 'youtube', 'ventas', 'otro'] as const;

const ETIQUETA: Record<string, string> = {
  sitio: 'Sitio web',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  ventas: 'Página de venta',
  otro: 'Otro',
};

export default function LinksEditor({
  clientId,
  iniciales,
}: {
  clientId: string;
  iniciales: Enlace[];
}) {
  const [enlaces, setEnlaces] = useState<Enlace[]>(iniciales);
  const [tipo, setTipo] = useState<string>('sitio');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);

    try {
      const res = await fetch(`/api/clientes/${clientId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, url }),
      });
      const cuerpo = await res.json();

      if (cuerpo.ok) {
        setEnlaces((previos) => [...previos, cuerpo.enlace]);
        setUrl('');
      } else {
        setError((cuerpo.errores ?? ['No se pudo agregar el enlace.']).join(' · '));
      }
    } catch {
      setError('No se pudo contactar al servidor.');
    }

    setOcupado(false);
  }

  async function quitar(id: string) {
    setError(null);
    const previos = enlaces;
    setEnlaces((e) => e.filter((l) => l.id !== id));

    try {
      const res = await fetch(`/api/clientes/${clientId}/links?linkId=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setEnlaces(previos);
        setError('No se pudo quitar el enlace.');
      }
    } catch {
      setEnlaces(previos);
      setError('No se pudo contactar al servidor.');
    }
  }

  return (
    <div>
      {enlaces.length === 0 ? (
        <div className="vacio">
          <strong>Sin enlaces</strong>
          La investigación no podrá revisar los activos del cliente.
        </div>
      ) : (
        <ul className="lista-enlaces">
          {enlaces.map((l) => (
            <li key={l.id}>
              <span className="etiqueta">{ETIQUETA[l.tipo] ?? l.tipo}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.url}
              </a>
              <button
                type="button"
                className="btn fantasma chico"
                onClick={() => quitar(l.id)}
                aria-label={`Quitar ${l.url}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="aviso rosa" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      <form className="agregar" onSubmit={agregar}>
        <div className="campo">
          <label htmlFor="tipo-enlace">Tipo</label>
          <select id="tipo-enlace" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="campo crece">
          <label htmlFor="url-enlace">URL</label>
          <input
            id="url-enlace"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="instagram.com/lacuenta"
            required
          />
        </div>

        <button type="submit" className="btn" disabled={ocupado || url.trim() === ''}>
          {ocupado ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
    </div>
  );
}
