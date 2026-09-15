import type { Tema } from '@/lib/ui/tema';

type ApiTema = { elegir(t: Tema): void };

function sincronizar() {
  const actual = document.documentElement.dataset.tema;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tema-valor]')) {
    b.setAttribute('aria-checked', String(b.dataset.temaValor === actual));
  }
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tema-valor]')) {
  b.addEventListener('click', () => {
    (window as unknown as { __wozialTema?: ApiTema }).__wozialTema?.elegir(b.dataset.temaValor as Tema);
  });
}

// El script en línea avisa cada cambio, también cuando lo provoca el dispositivo.
document.addEventListener('wozial:tema', sincronizar);
sincronizar();
