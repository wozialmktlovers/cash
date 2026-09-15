import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- debeConvertirLecturas: función pura -----------------------------------
//
// Punto 1 de la corrección: la regla de "¿toca arrancar la conversión de
// lecturas en este tick?" se prueba sola, sin worker, sin base de datos y sin
// reloj. Import normal (no hoisted): esta función no toca `@/db`.
import { debeConvertirLecturas } from '@/research/worker';

describe('debeConvertirLecturas', () => {
  const base = { colaVacia: true, yaIntentada: false, tieneApiKey: true, activada: true };

  it('sí, cuando las cuatro condiciones se cumplen', () => {
    expect(debeConvertirLecturas(base)).toBe(true);
  });

  it('no, si hay jobs en cola: esos van primero', () => {
    expect(debeConvertirLecturas({ ...base, colaVacia: false })).toBe(false);
  });

  it('no, si ya se intentó en este arranque', () => {
    expect(debeConvertirLecturas({ ...base, yaIntentada: true })).toBe(false);
  });

  it('no, sin ANTHROPIC_API_KEY', () => {
    expect(debeConvertirLecturas({ ...base, tieneApiKey: false })).toBe(false);
  });

  it('no, con CONVERTIR_LECTURAS=0 (activada en false)', () => {
    expect(debeConvertirLecturas({ ...base, activada: false })).toBe(false);
  });
});

// --- tick(): integración con una base de datos simulada --------------------
//
// Mismo enfoque tosco que `tests/research/convertir-lecturas.test.ts`
// (`vi.hoisted` + mock de `@/db` que ignora las condiciones de `where`,
// solo importan sus efectos): alcanza para probar que un job en cola nunca
// compite con la conversión, y viceversa.
const mockDb = vi.hoisted(() => {
  const estado: { filasJobs: any[]; actualizaciones: any[] } = { filasJobs: [], actualizaciones: [] };
  // `researchJobs`/`clients` son las únicas tablas que de verdad usa `tick()`.
  // `users` y `notificaciones` solo están porque `@/flujo/avisos` (importado
  // por `worker.ts` para avisar de un job fallido) referencia sus columnas a
  // nivel de módulo (`users.id`, etc.): sin ellas ni siquiera se puede
  // importar `worker.ts`, aunque `tick()` no dispare ningún aviso en estas
  // pruebas.
  const TABLAS = {
    researchJobs: { __tabla: 'researchJobs' },
    clients: { __tabla: 'clients' },
    users: { id: 'id', email: 'email', nombre: 'nombre', rol: 'rol', activo: 'activo' },
    notificaciones: { __tabla: 'notificaciones' },
  };

  function chain(resultado: any[]): any {
    const obj: any = {
      where: () => obj,
      orderBy: () => obj,
      limit: (n: number) => chain(resultado.slice(0, n)),
      then: (resuelve: any, rechaza: any) => Promise.resolve(resultado).then(resuelve, rechaza),
    };
    return obj;
  }

  const db = {
    select: (..._cols: any[]) => ({
      from: (tabla: any) => chain(tabla === TABLAS.researchJobs ? estado.filasJobs : []),
    }),
    update: (tabla: any) => ({
      set: (valores: any) => ({
        where: (..._cond: any[]) => {
          estado.actualizaciones.push({ tabla, valores });
          return Promise.resolve();
        },
      }),
    }),
  };

  return { estado, TABLAS, db };
});

vi.mock('@/db', () => ({
  researchJobs: mockDb.TABLAS.researchJobs,
  clients: mockDb.TABLAS.clients,
  users: mockDb.TABLAS.users,
  notificaciones: mockDb.TABLAS.notificaciones,
  db: mockDb.db,
}));

// Los tres pipelines y la conversión se mockean para que `tick()` no haga
// trabajo real: lo único que importa aquí es a cuál llama y en qué orden.
// `vi.hoisted` por la misma razón que `mockDb` arriba: las fábricas de
// `vi.mock` se elevan sobre los `const` normales del archivo.
const { ejecutarJob, ejecutarGrowth, ejecutarPilares, limpiarSesionesVencidas, convertirLecturasPendientes } = vi.hoisted(() => ({
  ejecutarJob: vi.fn(async () => {}),
  ejecutarGrowth: vi.fn(async () => {}),
  ejecutarPilares: vi.fn(async () => {}),
  limpiarSesionesVencidas: vi.fn(async () => {}),
  convertirLecturasPendientes: vi.fn(async () => ({ convertidas: 0, invalidas: 0, pendientes: 0, gasto: 0 })),
}));

// `@/research/pipeline`, no `./pipeline`: `vi.mock` resuelve la ruta desde
// este archivo (tests/research/), no desde `worker.ts` (src/research/), así
// que el especificador relativo de `worker.ts` no sirve aquí.
vi.mock('@/research/pipeline', () => ({ ejecutarJob }));
vi.mock('@/growth/pipeline', () => ({ ejecutarGrowth }));
vi.mock('@/pilares/pipeline', () => ({ ejecutarPilares }));
vi.mock('@/lib/auth', () => ({ limpiarSesionesVencidas }));
vi.mock('@/research/convertir-lecturas', () => ({ convertirLecturasPendientes }));

describe('tick', () => {
  beforeEach(() => {
    // `corriendo`, `arrancado` y `conversionIntentada` viven como variables
    // de módulo en `worker.ts` ("una sola vez por arranque" depende de eso).
    // Sin `resetModules` la segunda prueba heredaría el `conversionIntentada
    // = true` que dejó la primera, y "una sola vez por arranque" dejaría de
    // probar nada: cada prueba necesita su propio "arranque" limpio.
    vi.resetModules();
    mockDb.estado.filasJobs = [];
    mockDb.estado.actualizaciones = [];
    ejecutarJob.mockClear();
    ejecutarGrowth.mockClear();
    ejecutarPilares.mockClear();
    convertirLecturasPendientes.mockClear();
    convertirLecturasPendientes.mockImplementation(async () => ({ convertidas: 0, invalidas: 0, pendientes: 0, gasto: 0 }));
    process.env.ANTHROPIC_API_KEY = 'sk-test-no-se-usa';
    delete process.env.CONVERTIR_LECTURAS;
  });

  it('con la cola vacía y las condiciones dadas, arranca la conversión', async () => {
    const { tick } = await import('@/research/worker');
    await tick();
    expect(convertirLecturasPendientes).toHaveBeenCalledTimes(1);
    expect(ejecutarJob).not.toHaveBeenCalled();
  });

  it('con un job en cola, corre el pipeline y NO arranca la conversión', async () => {
    mockDb.estado.filasJobs = [{ id: 'j1', tipo: 'research', estado: 'encolado', creadoPor: null, clientId: 'c1', createdAt: new Date() }];
    const { tick } = await import('@/research/worker');
    await tick();
    expect(ejecutarJob).toHaveBeenCalledTimes(1);
    expect(convertirLecturasPendientes).not.toHaveBeenCalled();
  });

  it('sin ANTHROPIC_API_KEY, la cola vacía no arranca nada', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { tick } = await import('@/research/worker');
    await tick();
    expect(convertirLecturasPendientes).not.toHaveBeenCalled();
  });

  it('con CONVERTIR_LECTURAS=0, la cola vacía no arranca nada', async () => {
    process.env.CONVERTIR_LECTURAS = '0';
    const { tick } = await import('@/research/worker');
    await tick();
    expect(convertirLecturasPendientes).not.toHaveBeenCalled();
  });

  it('se intenta una sola vez por arranque: un segundo tick con la cola vacía no la repite', async () => {
    const { tick } = await import('@/research/worker');
    await tick();
    await tick();
    expect(convertirLecturasPendientes).toHaveBeenCalledTimes(1);
  });

  it('mientras la conversión está en curso, un tick posterior no toma jobs (mismo candado)', async () => {
    // `convertirLecturasPendientes` no resuelve hasta que el test lo permite:
    // así se puede llamar a `tick()` OTRA VEZ mientras la primera sigue viva,
    // igual que haría el `setInterval` real de 5s si la conversión tardara más.
    let liberar!: () => void;
    convertirLecturasPendientes.mockImplementationOnce(() => new Promise((resuelve) => {
      liberar = () => resuelve({ convertidas: 0, invalidas: 0, pendientes: 0, gasto: 0 });
    }));

    const { tick } = await import('@/research/worker');
    const primerTick = tick(); // no se espera todavía: la conversión queda "en curso".

    // Deja que el primer `tick()` pase su `await db.select(...)` inicial (la
    // consulta de jobs) y llegue a `corriendo = true` / `convertirLecturasPendientes()`
    // —que se queda pendiente por el gate de arriba— antes de seguir. Un
    // macrotask (`setTimeout 0`) vacía cualquier cadena de microtasks
    // pendiente sin apostar a cuántos `await` internos tiene la cadena mock.
    await new Promise((r) => setTimeout(r, 0));

    // Aparece un job mientras la conversión corre.
    mockDb.estado.filasJobs = [{ id: 'j1', tipo: 'research', estado: 'encolado', creadoPor: null, clientId: 'c1', createdAt: new Date() }];
    await tick(); // debe salir de inmediato por el candado `corriendo`, sin tocar el job.
    expect(ejecutarJob).not.toHaveBeenCalled();

    liberar();
    await primerTick;

    // Ya sin la conversión en curso, un tick posterior sí toma el job.
    await tick();
    expect(ejecutarJob).toHaveBeenCalledTimes(1);
  });
});
