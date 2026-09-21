import type { Role } from '@/domain/types'

/**
 * El unico archivo con espanol. `CONVENTIONS.md` seccion 2.1 y seccion 4 regla
 * 7: las uniones viven en ingles canonico y la etiqueta se aplica al
 * renderizar. Un test recorre los componentes y falla si encuentra espanol en
 * linea, para que esto siga siendo cierto.
 */
export const es = {
  role: {
    starter: 'Abridor',
    reliever: 'Relevista',
  } satisfies Record<Role, string>,
  unknownRole: 'Sin rol',
  insufficientSample: 'muestra insuficiente',
  inconclusive: 'no concluyente',
  inconclusiveShort: 'no concl.',
  brand: { top: 'SUPER', bottom: 'ESTELA' },
  nav: {
    groups: { signings: 'Fichajes', roster: 'Roster', lab: 'Laboratorio' },
    items: {
      radar: 'Radar de candidatos',
      roster: 'Plantel',
      deployment: 'Despliegue',
      simulator: 'Simulador de Pitch',
      translator: 'Traductor de Altitud',
    },
    pending: 'Pantalla pendiente',
  },
  densityIndex: '\u00cdndice de Densidad',
  atHarpHelu: '\u00b7 Harp Hel\u00fa',
  baselineNote: (pitches: number, seasons: number): string =>
    `Stuff+ v0 baseline \u00b7 ${pitches.toLocaleString('es-MX')} lanzamientos \u00b7 ${String(seasons)} temporadas`,
  filter: 'Filtrar',
  all: 'Todos',
  trapsOnly: 'Solo Trampas',
  noMatches: 'Ning\u00fan candidato cumple estos filtros.',
  throws: { Right: 'Diestros', Left: 'Zurdos' } as Record<string, string | undefined>,
  rolePlural: { starter: 'Abridores', reliever: 'Relevistas' } satisfies Record<Role, string>,
  sortBy: 'Ordenar por',
  legend: {
    trap: 'Trampa de Altitud \u2014 se ve fuerte a nivel del mar, colapsa en el Harp Hel\u00fa.',
    inconclusive: (significant: number, total: number): string =>
      `\u2014 el Impuesto no alcanza significancia: solo ${String(significant)} de ${String(total)} la alcanzan.`,
    stale:
      'Temporada en \u00e1mbar \u2014 su \u00faltimo dato no es de la temporada m\u00e1s reciente.',
    showing: (shown: number, total: number): string =>
      `Mostrando ${String(shown)} de ${String(total)} \u00b7 \u00faltima temporada jugada de cada uno \u00b7 banda al 95%`,
  },
  environment: { hh: 'Stuff+ HH', sea: 'Stuff+ nivel del mar' },
  columns: [
    'Pitcher',
    'Temp.',
    'Mano',
    'Stuff+ HH',
    'Nivel del mar',
    '\u0394',
    'Impuesto c/9 ent.',
    'Rol',
    'Pitch principal',
    'Uso',
  ],
  title: 'Radar de Fichajes',
  subtitle:
    'Candidatos en su \u00faltima temporada jugada, ordenados por su valor proyectado en el Harp Hel\u00fa.',
  evaluated: 'Evaluados',
  conclusiveTax: 'Impuesto concluyente',
  traps: 'Trampas de Altitud',
  trapsOver: (total: number): string => `Trampas \u00b7 ${String(total)} temporadas`,
  outOf: (total: number): string => `de ${String(total)}`,
  trap: 'Trampa de Altitud',
  trapDescription: 'Se ve fuerte a nivel del mar y colapsa en el Harp Helú.',
} as const
