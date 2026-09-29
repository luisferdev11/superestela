import type { Environment, Role } from '@/domain/types'
import type { Control, Hand, SimMode } from '@/domain/simulator'
import type { StuffPlusReason } from '@/sources/simulateResponse'
import type { FichaTab } from '@/domain/navigation'
import type { SeasonStatus } from '@/domain/pitcher'

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
  ficha: {
    breadcrumb: 'Fichajes',
    tabs: {
      summary: 'Resumen',
      arsenal: 'Arsenal',
      projection: 'Proyección',
      plan: 'Plan de Desarrollo',
    } satisfies Record<FichaTab, string>,
    heading: (id: string, season: number): string => `${id} · ${String(season)}`,
    sample: (hand: string, hh: number, sea: number): string =>
      `${hand} · ${hh.toLocaleString('es-MX')} lanzamientos en altitud · ${sea.toLocaleString('es-MX')} a nivel del mar`,
    hands: { Right: 'Diestro', Left: 'Zurdo' } as Record<string, string | undefined>,
    kpi: {
      hh: 'Stuff+ Harp Helú',
      sea: 'Nivel del mar',
      delta: 'Δ por altitud',
      tax: 'Impuesto de Altitud',
      taxMeasured: (measured: string): string =>
        `mide ${measured} c/9 ent.; la banda cruza el cero`,
      taxUnit: 'c/9 ent.',
      loss: 'Pierde',
      lossUnit: 'de IVB promedio en su arsenal.',
      rank: (sea: number, hh: number, of: number): string =>
        `A nivel del mar es el #${String(sea)} de ${String(of)} en su temporada; en el Harp Helú, el #${String(hh)}.`,
      belowAverage: 'En el Harp Helú queda por debajo del promedio.',
    },
    arsenal: {
      title: 'Arsenal \u00b7 nivel del mar \u2192 Harp Hel\u00fa',
      columns: ['Pitch', 'Uso', 'Velo', 'IVB', '|HB|', 'Spin', 'Stuff+', 'Whiff'],
      measuredAt:
        'Uso, velocidad, spin y whiff, medidos en el Harp Hel\u00fa. IVB y |HB| en pulgadas; Stuff+ con su banda al 95%.',
      noSea: 'sin muestra a nivel del mar',
    },
    map: {
      title: 'Mapa de movimiento',
      sea: 'nivel del mar',
      hh: 'Harp Hel\u00fa',
      league: 'promedio LMB',
      up: 'sube',
      down: 'cae',
      arm: 'brazo \u25b8',
      glove: '\u25c2 guante',
      axisX: 'break horizontal (pulgadas)',
      axisY: 'IVB',
      usage: (share: number): string => `${(100 * share).toFixed(1)}% de uso`,
      label: (pitch: string, sea: string, hh: string): string =>
        `${pitch}: ${sea} a nivel del mar, ${hh} en el Harp Hel\u00fa`,
      none: 'sin muestra',
      note: 'Forma medida en cada entorno, no simulada. Break horizontal del lado del brazo. El uso es el de nivel del mar; la tabla da el del Harp Hel\u00fa.',
    },
    physics: {
      title: 'El mecanismo f\u00edsico.',
      body: (density: string, magnus: string): string =>
        `El aire del Harp Hel\u00fa tiene densidad ${density} respecto al nivel del mar, medida desde la trayectoria de la bola. El efecto Magnus escala con esa densidad: ${magnus}. El brazo es el mismo; lo que cambia es cu\u00e1nto break puede sostener el aire.`,
    },
    seasons: {
      title: 'Sus temporadas',
      rule: (min: number): string => `${String(min)} lanzamientos en cada entorno para tener score`,
      columns: ['Temporada', 'En altitud', 'A nivel del mar', 'Rol', 'Estado'],
      status: {
        scored: 'con score',
        shortSea: 'muestra insuficiente',
        shortHh: 'muestra insuficiente',
        shortBoth: 'muestra insuficiente',
        absent: 'no lanzó',
      } satisfies Record<SeasonStatus, string>,
      shortSea: (season: number, hh: number, sea: number): string =>
        `En ${String(season)} lanzó ${String(hh)} veces en altitud, pero solo ${String(sea)} a nivel del mar: no hay comparación que hacer.`,
      shortHh: (season: number, hh: number, sea: number): string =>
        `En ${String(season)} lanzó ${String(sea)} veces a nivel del mar, pero solo ${String(hh)} en altitud: no hay comparación que hacer.`,
      gap: (season: number): string =>
        `En ${String(season)} no lanzó. La Ficha no promedia alrededor del hueco: son dos mediciones distintas.`,
      gapContext: (n: number): string =>
        `${String(n)} lanzadores del dataset se ausentaron una temporada completa y volvieron.`,
    },
  },
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
