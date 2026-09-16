import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, contenidoLotes, researchResults } from '@/db';
import { DIAS_REVISION_POR_OMISION, periodoValido, type Paquete } from '@/contenido/reglas';
import { sincronizarEtapa } from '@/contenido/servicio';
import { NOMBRE_ETAPA, dependenciasCumplidas } from '@/flujo/reglas';
import { etapasDelCliente } from '@/flujo/servicio';
import { investigacionUtil } from '@/lib/precheck';
import { violaRestriccionUnica } from '@/lib/unicidad';
import { clienteOperable } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** Nombre de la restricción única de (cliente, periodo) en la migración de la etapa 3. */
const RESTRICCION_PERIODO = 'contenido_lotes_client_id_periodo';

const cuerpoSchema = z.object({
  clientId: z.string().trim().min(1, 'Falta el cliente'),
  periodo: z.string().trim().min(1, 'Falta el periodo'),
});

/**
 * `POST /api/contenido/lotes` `{ clientId, periodo }`: abre el lote del mes
 * (diseño §2). Solo lo abre quien opera al cliente; un usuario cliente ni
 * siquiera llega —`/api/contenido/*` no está en las rutas del rol cliente
 * (src/lib/permisos.ts), así que el middleware lo corta con 403.
 *
 * Códigos:
 * - 400 cuerpo ilegible, sin cliente o sin periodo, o periodo que no es
 *   `AAAA-MM` con mes 01–12 (`periodoValido`, el mismo criterio que el CHECK
 *   de la tabla);
 * - 404 el cliente no existe o no es de quien pregunta (nunca 403: el código
 *   de respuesta no debe delatar qué clientes existen);
 * - 409 la etapa no está contratada, o falta la investigación con datos de la
 *   que sale todo lo demás, o ese mes ya tiene lote;
 * - 201 creado.
 *
 * **El 409 del mes repetido lo decide el error de Postgres, no un `SELECT`
 * previo.** Entre la consulta y la escritura cabe otra petición con el mismo
 * mes —dos operadores abriendo septiembre a la vez—, así que la restricción
 * única de la tabla es la única comprobación libre de carreras. Mismo criterio
 * que el correo repetido en `PATCH /api/admin/usuarios/[id]`.
 *
 * **NO se comprueba `puedeGenerar`**, que es lo que usa `POST /api/jobs`. Esa
 * función bloquea la etapa `en_revision` o `aprobada`, y aquí eso sería un
 * error: la etapa 3 refleja el estado del lote ACTIVO, así que un cliente con
 * septiembre aprobado tiene la etapa `aprobada` y abrir octubre es justo lo que
 * toca (diseño §2). Lo que sí se conserva de ahí son los dos chequeos que no
 * dependen del estado: contratada y dependencias.
 *
 * **Heredar el paquete** (diseño §3) no copia nada: el paquete y los días de
 * revisión viven en el cliente —así lo dejó A1, y por eso `contenido_lotes` no
 * tiene esas columnas—, y cada lote los lee de ahí. La respuesta los devuelve
 * ya resueltos para que quien abre el mes vea con qué lo abre, con
 * `dias_revision` nulo traducido a los 2 de por omisión.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = cuerpoSchema.safeParse(crudo);
  if (!r.success) return json({ ok: false, errores: r.error.issues.map((i) => i.message) }, 400);
  const { clientId, periodo } = r.data;

  const cliente = await clienteOperable(locals.usuario, clientId);
  if (!cliente) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  if (!periodoValido(periodo)) {
    return json({ ok: false, errores: ['El periodo debe ser un mes en formato AAAA-MM.'] }, 400);
  }

  const etapas = await etapasDelCliente(clientId);
  const fila = etapas.find((e) => e.etapa === 'desarrollo_mensual');
  if (!fila || (!fila.contratada && !fila.interna)) {
    return json({ ok: false, errores: [`${NOMBRE_ETAPA.desarrollo_mensual} no está contratada.`] }, 409);
  }

  const previos = await db
    .select({ datos: researchResults.datos, version: researchResults.version })
    .from(researchResults)
    .where(eq(researchResults.clientId, clientId));
  const dependencias = dependenciasCumplidas('desarrollo_mensual', etapas, Boolean(investigacionUtil(previos)));
  if (!dependencias.ok) return json({ ok: false, errores: [dependencias.razon] }, 409);

  let creado;
  try {
    // El alta y el reflejo en `cliente_etapas` van juntos o no van: una etapa
    // que no sabe del lote que acaba de abrirse deja la ficha y el portal
    // mintiendo hasta la siguiente operación.
    creado = await db.transaction(async (tx) => {
      const [lote] = await tx
        .insert(contenidoLotes)
        .values({ clientId, periodo, creadoPor: locals.usuario.id })
        .returning({
          id: contenidoLotes.id,
          clientId: contenidoLotes.clientId,
          periodo: contenidoLotes.periodo,
          estado: contenidoLotes.estado,
          compartidoEn: contenidoLotes.compartidoEn,
          limiteRevision: contenidoLotes.limiteRevision,
          creadoEn: contenidoLotes.creadoEn,
        });
      await sincronizarEtapa(clientId, tx);
      return lote;
    });
  } catch (e) {
    if (!violaRestriccionUnica(e, RESTRICCION_PERIODO)) throw e;
    return json({ ok: false, errores: [`Este cliente ya tiene el lote de ${periodo}.`] }, 409);
  }

  return json({
    ok: true,
    lote: creado,
    paquete: (cliente.paquete ?? {}) as Paquete,
    diasRevision: cliente.diasRevision ?? DIAS_REVISION_POR_OMISION,
  }, 201);
};
