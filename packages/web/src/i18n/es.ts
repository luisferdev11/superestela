import type { Environment, Role } from '@/domain/types'
import type { Control, Hand, SimMode } from '@/domain/simulator'
import type { StuffPlusReason } from '@/sources/simulateResponse'

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
  // `docs/03` seccion 9: las condiciones del reto se declaran en el producto.
  compliance: {
    title: 'Uso de este producto',
    rules: [
      'Prohibido usarlo para apuestas.',
      'Los datos son de ISAC y del club: se presentan resultados, no los datos.',
      'El sistema recomienda; decide el cuerpo t\u00e9cnico.',
    ],
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
  sim: {
    title: 'Simulador de Pitch',
    subtitle:
      'Parte del pitch real de un lanzador, muévelo y compara lo que vale a nivel del mar y en el Harp Helú.',
    modes: { pitcher: 'Desde un lanzador', lab: 'Laboratorio' } satisfies Record<SimMode, string>,
    pitcher: 'Lanzador',
    pitcherOption: (id: string, season: number): string => `${id} · ${String(season)}`,
    pitch: 'Pitch',
    hand: 'Mano',
    hands: { Right: 'Diestro', Left: 'Zurdo' } satisfies Record<Hand, string>,
    usage: (share: number): string => `${(100 * share).toFixed(0)}% de uso`,
    groups: {
      shape: 'Forma · lo que decide',
      release: 'Release',
      spin: 'Spin · la coherencia de la forma',
    },
    controls: {
      releaseSpeed: 'Velocidad de salida',
      ivb: 'Induced vertical break',
      horizontalBreak: 'Break horizontal',
      extension: 'Extensión',
      releaseHeight: 'Altura de liberación',
      releaseSide: 'Lado de liberación',
      spinRate: 'Spin rate',
      spinAxis: 'Eje de giro',
    } satisfies Record<Control, string>,
    units: {
      releaseSpeed: 'mph',
      ivb: '″',
      horizontalBreak: '″',
      extension: 'ft',
      releaseHeight: 'ft',
      releaseSide: 'ft',
      spinRate: 'rpm',
      spinAxis: '°',
    } satisfies Record<Control, string>,
    armSideNote: 'Break y lado de liberación, positivos hacia el brazo que lanza.',
    leagueBand: 'banda p5–p95 de la LMB',
    baselineMark: 'su pitch real',
    resetPitcher: 'Volver al pitch real',
    resetLab: 'Volver a la mediana de la liga',
    kpi: {
      sea: 'Stuff+ a nivel del mar',
      hh: 'Stuff+ en Harp Helú',
      delta: 'Δ por altitud',
      shape: 'por la forma',
      environment: 'por el entorno',
      real: 'su pitch real',
    },
    reasons: {
      model_unavailable: 'Modelo no disponible. La física sigue contestando.',
      model_not_gated: 'Este modelo no pasó por las compuertas: su Stuff+ no se muestra.',
      gates_failed: 'El modelo no pasó sus compuertas de coherencia: su Stuff+ no se muestra.',
    } satisfies Record<StuffPlusReason, string>,
    physics: {
      title: 'Qué le hace la altura a esta forma',
      plateSpeed: 'Velocidad al plato',
      vaa: 'VAA a media zona',
      unchanged: 'no cambia',
      explanation: (density: string, magnus: string): string =>
        `En el Harp Helú el efecto Magnus —lo que mueve la pelota— cae a ${magnus} de su valor a nivel del mar, y todo el break se contrae en esa proporción. El aire también la frena menos (Índice de Densidad ${density}, medido desde la pelota), así que llega más rápida al plato. La velocidad de salida y el spin son del brazo, no del aire: no se tocan.`,
    },
    spin: {
      perKrpm: (value: string, percentile: string): string =>
        `${value}″ de movimiento por cada 1,000 rpm · percentil ${percentile} del tipo`,
      note: 'El spin entra al modelo, pero no decide: dice si la forma es coherente. En la altura el spin no cambia y el movimiento sí.',
      implausible:
        'Esta combinación no se ha lanzado en la LMB. El Stuff+ es una extrapolación: léelo con su banda.',
    },
    status: {
      loading: 'Calculando…',
      unreachable: 'No se pudo calcular: la API del Simulador no respondió.',
      rejected: 'La API rechazó este pitch. Revisa que los valores sean físicos.',
    },
    noRuns: 'El Simulador no imprime carreras: el puente de Stuff+ a carreras todavía no existe.',
    map: {
      title: 'Mapa de movimiento · pitches más y menos efectivos',
      subtitle: (pitchType: string): string =>
        `Whiff por swing observado de cada zona de forma de ${pitchType}, comparado con su media a nivel del mar. Vista del lanzador: el brazo a la derecha.`,
      panel: { sea: 'Nivel del mar', hh: 'Harp Helú' } satisfies Record<Environment, string>,
      armSide: 'brazo ▸',
      gloveSide: '◂ guante',
      rises: 'sube',
      drops: 'cae',
      axisIvb: 'IVB (pulgadas)',
      axisHb: 'break horizontal (pulgadas)',
      legend: {
        more: 'más whiff que la media',
        less: 'menos whiff que la media',
        most: '10% más efectivos',
        least: '10% menos efectivos',
        simulated: 'el pitch simulado',
        seaGhost: 'su forma a nivel del mar',
      },
      zone: (env: string, whiff: string, reference: string): string =>
        `${env}: la liga hace ${whiff} de whiff por swing en esta zona (media del tipo a nivel del mar: ${reference}).`,
      noZone: (env: string): string =>
        `${env}: la liga casi no lanza esta forma; no hay muestra en la zona.`,
      label: (pitchType: string, env: string, ivb: string, hb: string): string =>
        `Mapa de movimiento de ${pitchType} en ${env}. El pitch simulado cae en IVB ${ivb} y break horizontal ${hb} pulgadas.`,
    },
    arsenal: {
      title: (fastball: string): string => `Contra su recta · ${fastball}`,
      velocity: 'Velocidad',
      release: 'Distancia de release (túnel)',
      anchor: 'Este pitch es su recta primaria: los demás se miden contra él.',
      none: 'Sin recta en el arsenal contra la cual medir.',
      shrink:
        'En la altura los diferenciales de movimiento se encogen y los de velocidad no: el engaño por forma se pierde, el de velocidad sobrevive.',
    },
    comparables: {
      title: 'Los pitches reales más parecidos',
      row: (id: string, season: number, n: number): string =>
        `${id} · ${String(season)} · ${String(n)} pitches`,
      whiff: (value: string): string => `${value} whiff`,
    },
    provenance: (modelId: string, passed: number, total: number, usesArsenal: boolean): string =>
      `Stuff+ del modelo ${modelId} · pasó ${String(passed)} de ${String(total)} compuertas · ${usesArsenal ? 'usa' : 'no usa'} el arsenal`,
  },
} as const
