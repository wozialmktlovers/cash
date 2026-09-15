import type { Rol } from '@/lib/permisos';

export type ClaveNav = 'inicio' | 'clientes' | 'entregables' | 'pendientes' | 'usuarios' | 'desempeno';
export type IconoNav = 'inicio' | 'clientes' | 'entregables' | 'bandeja' | 'usuarios' | 'grafica';
export type ItemNav = { clave: ClaveNav; href: string; texto: string; icono: IconoNav; contador?: number };

/**
 * Navegación completa por rol, la misma que arma la barra lateral de
 * escritorio (`Base.astro`): Pendientes y Desempeño para admin y operador,
 * Usuarios solo para admin — las mismas reglas que separa `rutaPermitida`
 * (`/admin/*` es admin-only; el resto es admin+operador). Se extrae aparte
 * para poder probar «qué ve cada rol» sin renderizar el layout completo
 * (que depende de `Astro.locals` y de una consulta a la base).
 */
export function navegacionCompleta(rol: Rol, pendientes: number): ItemNav[] {
  const nav: ItemNav[] = [
    { clave: 'inicio', href: '/', texto: 'Inicio', icono: 'inicio' },
    { clave: 'clientes', href: '/clientes', texto: 'Clientes', icono: 'clientes' },
    { clave: 'entregables', href: '/entregables', texto: 'Entregables', icono: 'entregables' },
  ];
  if (rol === 'admin' || rol === 'operador') {
    nav.push({ clave: 'pendientes', href: '/pendientes', texto: 'Pendientes', icono: 'bandeja', contador: pendientes });
  }
  if (rol === 'admin') nav.push({ clave: 'usuarios', href: '/admin/usuarios', texto: 'Usuarios', icono: 'usuarios' });
  if (rol === 'admin' || rol === 'operador') nav.push({ clave: 'desempeno', href: '/desempeno', texto: 'Desempeño', icono: 'grafica' });
  return nav;
}

/**
 * Subconjunto de `navegacionCompleta` que va al menú «Más» del celular: todo
 * lo que no sea una de las cuatro pestañas fijas de la barra inferior
 * (Inicio, Clientes, el botón «Nuevo cliente», Entregables). Antes de este
 * menú, Pendientes/Desempeño/Usuarios no tenían ningún acceso bajo 900px.
 */
export function itemsMenuMas(nav: ItemNav[]): ItemNav[] {
  return nav.filter((n) => n.clave !== 'inicio' && n.clave !== 'clientes' && n.clave !== 'entregables');
}
