// Avisos del flujo de trabajo (spec §3, sección Avisos). En B3 es un no-op
// seguro: registra la intención sin tocar la tabla `notificaciones` ni enviar
// correo. B4 conecta aquí el envío real (inserta una fila por destinatario y
// llama a enviarCorreo).

export type EventoAviso = {
  tipo: string;
  etapaId?: string;
  clientId?: string;
  [clave: string]: unknown;
};

export async function notificar(_destinatarios: string[], _evento: EventoAviso): Promise<void> {
  // Intencionalmente vacío.
}
