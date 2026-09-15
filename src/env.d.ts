/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    userId: string;
    usuario: import('@/lib/permisos').UsuarioSesion;
  }
}
