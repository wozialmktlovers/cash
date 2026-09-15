export function toast(mensaje: string, tipo: 'ok' | 'error' = 'ok') {
  const contenedor = document.getElementById('toasts');
  if (!contenedor) return;
  const el = document.createElement('div');
  el.className = `toast ${tipo === 'error' ? 'error' : ''}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  el.textContent = mensaje;
  contenedor.appendChild(el);
  setTimeout(() => {
    el.classList.add('saliendo');
    setTimeout(() => el.remove(), 250);
  }, 4000);
}
