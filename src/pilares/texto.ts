import { normalizar } from '@/lib/ui/buscar';

// Módulo hoja: normaliza texto para comparar temas/nombres. Sin dependencias
// de otros archivos de `pilares`, así lo puede importar tanto `schemas.ts`
// como `revision.ts` sin duplicar la lógica.
export function normalizarTema(t: string): string {
  return normalizar(t).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
