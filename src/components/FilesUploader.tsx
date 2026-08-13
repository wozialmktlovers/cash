import { useRef, useState } from 'react';

export type Archivo = {
  id: string;
  nombreOriginal: string;
  mime: string;
  bytes: number;
  estadoExtraccion: 'pendiente' | 'ok' | 'fallo' | 'no_aplica';
};

const ESTADO: Record<Archivo['estadoExtraccion'], { texto: string; clase: string }> = {
  ok: { texto: 'Texto extraído', clase: 'completado' },
  no_aplica: { texto: 'Imagen, sin texto', clase: '' },
  fallo: { texto: 'No se pudo leer', clase: 'fallido' },
  pendiente: { texto: 'Pendiente', clase: 'encolado' },
};

const peso = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export default function FilesUploader({
  clientId,
  iniciales,
}: {
  clientId: string;
  iniciales: Archivo[];
}) {
  const [archivos, setArchivos] = useState<Archivo[]>(iniciales);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [encima, setEncima] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function subir(lista: FileList | File[]) {
    setError(null);
    const fallos: string[] = [];

    for (const f of Array.from(lista)) {
      setSubiendo((n) => n + 1);
      const cuerpo = new FormData();
      cuerpo.append('archivo', f);

      try {
        const res = await fetch(`/api/clientes/${clientId}/files`, { method: 'POST', body: cuerpo });
        const datos = await res.json();
        if (datos.ok) {
          setArchivos((previos) => [...previos, datos.archivo]);
        } else {
          fallos.push(`${f.name}: ${(datos.errores ?? []).join(' ')}`);
        }
      } catch {
        fallos.push(`${f.name}: no se pudo contactar al servidor`);
      }

      setSubiendo((n) => n - 1);
    }

    if (fallos.length) setError(fallos.join(' · '));
    if (entrada.current) entrada.current.value = '';
  }

  async function quitar(id: string) {
    setError(null);
    const previos = archivos;
    setArchivos((a) => a.filter((x) => x.id !== id));

    try {
      const res = await fetch(`/api/clientes/${clientId}/files?fileId=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setArchivos(previos);
        setError('No se pudo quitar el archivo.');
      }
    } catch {
      setArchivos(previos);
      setError('No se pudo contactar al servidor.');
    }
  }

  return (
    <div>
      {archivos.length === 0 ? (
        <div className="vacio">
          <strong>Sin archivos</strong>
          Se perderá el detalle del producto que solo está en los documentos.
        </div>
      ) : (
        <ul className="lista-archivos">
          {archivos.map((a) => {
            const e = ESTADO[a.estadoExtraccion] ?? ESTADO.pendiente;
            return (
              <li key={a.id}>
                <span className={`etiqueta ${e.clase}`}>{e.texto}</span>
                <span className="nombre">{a.nombreOriginal}</span>
                <span className="secundario">{peso(a.bytes)}</span>
                <button
                  type="button"
                  className="btn fantasma chico"
                  onClick={() => quitar(a.id)}
                  aria-label={`Quitar ${a.nombreOriginal}`}
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="aviso rosa" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      <div
        className={`zona${encima ? ' encima' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          if (e.dataTransfer.files.length) void subir(e.dataTransfer.files);
        }}
        onClick={() => entrada.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') entrada.current?.click();
        }}
      >
        <input
          ref={entrada}
          type="file"
          multiple
          hidden
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
          onChange={(e) => e.target.files && void subir(e.target.files)}
        />
        {subiendo > 0 ? (
          <p>
            Subiendo {subiendo} {subiendo === 1 ? 'archivo' : 'archivos'}…
          </p>
        ) : (
          <>
            <p className="titulo">Arrastra archivos aquí o haz clic</p>
            <p className="ayuda">PDF, DOCX, TXT, PNG y JPEG. Máximo 25 MB por archivo.</p>
          </>
        )}
      </div>
    </div>
  );
}
