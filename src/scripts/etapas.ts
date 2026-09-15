// Interacción de la línea de etapas y la contratación en la ficha del
// cliente (spec §3, B5): transiciones simples, los dos diálogos (confirmar
// «Aprobar» y el comentario general de «Pedir cambios»/«Reabrir») y el
// guardado de «Etapas contratadas». El servidor sigue siendo la autoridad:
// aquí solo se refleja lo que ya decidió `botonesEtapa` al pintar la página,
// y un 409 se muestra tal cual en un toast.
import { toast } from './toast';

const clientId = window.location.pathname.split('/')[2];

async function transicion(etapaId: string, accion: string, comentario?: string): Promise<{ ok: boolean; razon?: string }> {
  try {
    const res = await fetch(`/api/etapas/${etapaId}/transicion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comentario === undefined ? { accion } : { accion, comentario }),
    });
    const cuerpo = await res.json();
    if (cuerpo.ok) return { ok: true };
    return { ok: false, razon: (cuerpo.errores ?? ['No se pudo completar la acción.']).join(' · ') };
  } catch {
    return { ok: false, razon: 'No se pudo contactar al servidor.' };
  }
}

/** Tras una acción con éxito: toast y recarga suave de la ficha para que la línea de etapas refleje el nuevo estado. */
function exito(mensaje: string) {
  toast(mensaje);
  setTimeout(() => location.reload(), 600);
}

const MENSAJE_ACCION: Record<string, string> = {
  iniciar: 'Etapa iniciada',
  solicitar: 'Autorización solicitada',
  aprobar: 'Etapa aprobada',
  pedir_cambios: 'Cambios pedidos',
  reabrir: 'Etapa reabierta',
};

// ── Botones de una sola acción: Iniciar, Solicitar autorización ──────────
// Se excluyen los que abren un diálogo: «Pedir cambios» y «Reabrir» también
// llevan `data-accion` (el diálogo la lee de ahí), y si entraran aquí la
// transición saldría sin comentario al abrir el diálogo, cambiando el estado
// y avisando al operador antes de que el admin escriba nada.
document.querySelectorAll<HTMLButtonElement>('[data-accion]:not([data-abrir])').forEach((boton) => {
  boton.addEventListener('click', async () => {
    const etapaId = boton.dataset.etapaId!;
    const accion = boton.dataset.accion!;
    boton.disabled = true;
    const { ok, razon } = await transicion(etapaId, accion);
    if (ok) exito(MENSAJE_ACCION[accion] ?? 'Listo');
    else { toast(razon ?? 'No se pudo completar la acción.', 'error'); boton.disabled = false; }
  });
});

// ── Generar (manual de campaña): igual que el botón de la tarjeta anterior,
// encola el job y navega a su progreso; no pasa por `transicion`. ─────────
document.querySelectorAll<HTMLButtonElement>('[data-generar-growth]').forEach((boton) => {
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    const original = boton.textContent;
    boton.textContent = 'Encolando…';
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, tipo: 'growth' }),
      });
      const cuerpo = await res.json();
      if (cuerpo.ok) { location.href = `/jobs/${cuerpo.id}`; return; }
      if (cuerpo.jobId) { location.href = `/jobs/${cuerpo.jobId}`; return; }
      toast((cuerpo.errores ?? ['No se pudo encolar.']).join(' · '), 'error');
    } catch {
      toast('Sin conexión con el servidor.', 'error');
    }
    boton.disabled = false;
    boton.textContent = original;
  });
});

// ── Diálogo «Aprobar»: confirmación, con foco de vuelta al botón que lo abrió. ─
const dialogoAprobar = document.getElementById('dialogo-aprobar') as HTMLDialogElement | null;
if (dialogoAprobar) {
  const texto = document.getElementById('aprobar-texto') as HTMLElement;
  const confirmar = document.getElementById('aprobar-confirmar') as HTMLButtonElement;
  let disparador: HTMLElement | null = null;
  let etapaId = '';

  document.querySelectorAll<HTMLButtonElement>('[data-abrir="aprobar"]').forEach((boton) => {
    boton.addEventListener('click', () => {
      disparador = boton;
      etapaId = boton.dataset.etapaId!;
      texto.textContent = `¿Aprobar «${boton.dataset.etapaNombre}»? El cliente podrá verla como lista.`;
      confirmar.disabled = false;
      dialogoAprobar.showModal();
    });
  });
  document.getElementById('aprobar-cancelar')!.addEventListener('click', () => dialogoAprobar.close());
  dialogoAprobar.addEventListener('close', () => disparador?.focus());

  confirmar.addEventListener('click', async () => {
    confirmar.disabled = true;
    const { ok, razon } = await transicion(etapaId, 'aprobar');
    dialogoAprobar.close();
    if (ok) exito(MENSAJE_ACCION.aprobar);
    else toast(razon ?? 'No se pudo aprobar.', 'error');
  });
}

// ── Diálogo de comentario general: «Pedir cambios» y «Reabrir» comparten el
// mismo <dialog>; el textarea es obligatorio salvo pedir_cambios cuando ya
// hay comentarios abiertos (espeja la regla del servidor; el servidor manda
// si de todas formas se manda vacío). ─────────────────────────────────────
const dialogoComentario = document.getElementById('dialogo-comentario') as HTMLDialogElement | null;
if (dialogoComentario) {
  const titulo = document.getElementById('comentario-titulo') as HTMLElement;
  const etiqueta = document.getElementById('comentario-etiqueta') as HTMLElement;
  const textarea = document.getElementById('comentario-texto') as HTMLTextAreaElement;
  const forma = document.getElementById('forma-comentario') as HTMLFormElement;
  const enviar = document.getElementById('comentario-enviar') as HTMLButtonElement;
  const error = document.getElementById('comentario-error') as HTMLElement;
  let disparador: HTMLElement | null = null;
  let etapaId = '';
  let accion = '';

  const TITULO: Record<string, string> = { pedir_cambios: 'Pedir cambios', reabrir: 'Reabrir etapa' };

  document.querySelectorAll<HTMLButtonElement>('[data-abrir="comentario"]').forEach((boton) => {
    boton.addEventListener('click', () => {
      disparador = boton;
      etapaId = boton.dataset.etapaId!;
      accion = boton.dataset.accion!;
      const requiere = boton.dataset.requiere === 'true';
      titulo.textContent = `${TITULO[accion] ?? 'Comentario'} · ${boton.dataset.etapaNombre}`;
      etiqueta.textContent = requiere ? 'Comentario (obligatorio)' : 'Comentario (opcional: ya hay comentarios abiertos)';
      textarea.required = requiere;
      textarea.value = '';
      error.hidden = true;
      enviar.disabled = false;
      dialogoComentario.showModal();
      textarea.focus();
    });
  });
  document.getElementById('comentario-cancelar')!.addEventListener('click', () => dialogoComentario.close());
  dialogoComentario.addEventListener('close', () => disparador?.focus());

  forma.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    enviar.disabled = true;
    const { ok, razon } = await transicion(etapaId, accion, textarea.value.trim());
    if (ok) { dialogoComentario.close(); exito(MENSAJE_ACCION[accion] ?? 'Listo'); return; }
    error.textContent = razon ?? 'No se pudo completar la acción.';
    error.hidden = false;
    enviar.disabled = false;
  });
}

// ── Etapas contratadas: PUT con la selección y recarga suave. ────────────
const formaContratacion = document.getElementById('forma-contratacion') as HTMLFormElement | null;
if (formaContratacion) {
  const guardar = document.getElementById('guardar-contratacion') as HTMLButtonElement;
  formaContratacion.addEventListener('submit', async (e) => {
    e.preventDefault();
    guardar.disabled = true;
    const etapas = new FormData(formaContratacion).getAll('etapas');
    try {
      const res = await fetch(`/api/clientes/${clientId}/etapas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapas }),
      });
      const cuerpo = await res.json();
      if (cuerpo.ok) { exito('Etapas contratadas actualizadas'); return; }
      toast((cuerpo.errores ?? ['No se pudieron guardar las etapas.']).join(' · '), 'error');
    } catch {
      toast('No se pudo contactar al servidor.', 'error');
    }
    guardar.disabled = false;
  });
}
