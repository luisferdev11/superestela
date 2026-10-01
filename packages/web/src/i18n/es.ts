import type { Environment, Role } from '@/domain/types'
import type { Control, Hand, SimMode } from '@/domain/simulator'
import type { StuffPlusReason } from '@/sources/simulateResponse'
import type { FichaTab } from '@/domain/navigation'
import type { SeasonStatus } from '@/domain/pitcher'
import type { Verdict } from '@/domain/reading'
import type { Target } from '@/domain/projection'
import type { RosterGrouping } from '@/domain/roster'

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
  atExtreme: '· altitud extrema',
  extremeParks:
    'Promedio de cinco parques: Puebla, Ciudad de México, Aguascalientes, Querétaro y León. El dataset no distingue entre ellos.',
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
    trap: 'Trampa de Altitud \u2014 se ve fuerte a nivel del mar, colapsa en altitud extrema.',
    inconclusive: (significant: number, total: number): string =>
      `\u2014 el Impuesto no alcanza significancia: solo ${String(significant)} de ${String(total)} la alcanzan.`,
    stale:
      'Temporada en \u00e1mbar \u2014 su \u00faltimo dato no es de la temporada m\u00e1s reciente.',
    showing: (shown: number, total: number): string =>
      `Mostrando ${String(shown)} de ${String(total)} \u00b7 \u00faltima temporada jugada de cada uno \u00b7 banda al 95%`,
  },
  environment: { hh: 'Stuff+ altitud extrema', sea: 'Stuff+ nivel del mar' },
  columns: [
    'Pitcher',
    'Temp.',
    'Mano',
    'Stuff+ alt. extrema',
    'Nivel del mar',
    '\u0394',
    'Impuesto c/9 ent.',
    'Rol',
    'Pitch principal',
    'Uso',
  ],
  title: 'Radar de Fichajes',
  subtitle:
    'Candidatos en su \u00faltima temporada jugada, ordenados por su valor en altitud extrema, la de la casa de Diablos.',
  evaluated: 'Evaluados',
  conclusiveTax: 'Impuesto concluyente',
  traps: 'Trampas de Altitud',
  trapsOver: (total: number): string => `Trampas \u00b7 ${String(total)} temporadas`,
  outOf: (total: number): string => `de ${String(total)}`,
  trap: 'Trampa de Altitud',
  trapDescription: 'Se ve fuerte a nivel del mar y colapsa en altitud extrema.',
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
      hh: 'Stuff+ altitud extrema',
      sea: 'Nivel del mar',
      delta: 'Δ por altitud',
      tax: 'Impuesto de Altitud',
      taxMeasured: (measured: string): string =>
        `mide ${measured} c/9 ent.; la banda cruza el cero`,
      taxUnit: 'c/9 ent.',
      loss: 'Pierde',
      lossUnit: 'de IVB promedio en su arsenal.',
      rank: (sea: number, hh: number, of: number): string =>
        `A nivel del mar es el #${String(sea)} de ${String(of)} en su temporada; en altitud extrema, el #${String(hh)}.`,
      belowAverage: 'En altitud extrema queda por debajo del promedio.',
    },
    arsenal: {
      title: 'Arsenal \u00b7 nivel del mar → altitud extrema',
      columns: ['Pitch', 'Uso', 'Velo', 'IVB', '|HB|', 'Spin', 'Stuff+', 'Whiff', 'Simulador'],
      simulate: 'abrir \u2192',
      simulateLabel: (pitch: string): string => `Abrir el ${pitch} en el Simulador`,
      measuredAt:
        'Uso, velocidad, spin y whiff, medidos en altitud extrema. IVB y |HB| en pulgadas; Stuff+ con su banda al 95%.',
      noSea: 'sin muestra a nivel del mar',
    },
    map: {
      title: 'Mapa de movimiento',
      sea: 'nivel del mar',
      hh: 'Altitud extrema',
      league: 'promedio LMB',
      up: 'sube',
      down: 'cae',
      arm: 'brazo \u25b8',
      glove: '\u25c2 guante',
      axisX: 'break horizontal (pulgadas)',
      axisY: 'IVB',
      usage: (share: number): string => `${(100 * share).toFixed(1)}% de uso`,
      label: (pitch: string, sea: string, hh: string): string =>
        `${pitch}: ${sea} a nivel del mar, ${hh} en altitud extrema`,
      none: 'sin muestra',
      note: 'Forma medida en cada entorno, no simulada. Break horizontal del lado del brazo. El uso es el de nivel del mar; la tabla da el de altitud extrema.',
    },
    physics: {
      title: 'El mecanismo f\u00edsico.',
      body: (density: string, magnus: string): string =>
        `El aire en altitud extrema tiene densidad ${density} respecto al nivel del mar, medida desde la trayectoria de la bola. El efecto Magnus escala con esa densidad: ${magnus}. El brazo es el mismo; lo que cambia es cu\u00e1nto break puede sostener el aire.`,
    },
    reading: {
      title: 'Lectura del sistema',
      verdict: {
        sign: 'Fichar.',
        signWithReservations: 'Fichar con reservas.',
        notAtSeaLevelPrice: 'No fichar al precio que marcan sus n\u00fameros de nivel del mar.',
      } satisfies Record<Verdict, string>,
      main: (pitch: string, usage: string, delta: string): string =>
        `Su pitch principal es el ${pitch}, al ${usage}% de uso, y en altitud extrema cambia ${delta} puntos de Stuff+.`,
      lever: (best: string, bestDelta: string, worst: string, worstDelta: string): string =>
        `Si ya estuviera en el roster, la palanca es el ${best}: es lo que mejor aguanta la altitud (${bestDelta} contra ${worstDelta} del ${worst}).`,
      rule: 'Regla provisional de producto: Trampa de Altitud, no al precio de nivel del mar; banda completa del Stuff+ en altitud extrema arriba de 100, fichar; lo dem\u00e1s, con reservas. El veredicto final lo respalda el modelo del equipo de datos.',
    },
    location: {
      title: (id: string): string => `Arsenal \u00b7 ${id}`,
      subtitle: 'C\u00f3mo son sus lanzamientos: la forma de cada uno, y d\u00f3nde los pone.',
      withSample: (n: number): string =>
        `${n.toLocaleString('es-MX')} lanzamientos suyos con ubicaci\u00f3n registrada.`,
      panel: { sea: 'Nivel del mar', hh: 'Altitud extrema' } satisfies Record<Environment, string>,
      pitches: (n: number): string => `${n.toLocaleString('es-MX')} lanzamientos`,
      view: 'vista del c\u00e1tcher',
      less: 'menos',
      more: 'm\u00e1s',
      stats: (height: string, zone: string, whiff: string): string =>
        `Altura media ${height} ft \u00b7 ${zone}% en zona \u00b7 ${whiff}% de whiff por swing.`,
      pending: 'Pendiente: la ubicaci\u00f3n la entrega el equipo de datos con Location+.',
      pendingDetail:
        'Aqu\u00ed va d\u00f3nde pone sus lanzamientos en cada entorno, su altura media, su porcentaje en zona y su whiff. El contrato est\u00e1 en docs/11.',
      shapeTitle: 'Forma por lanzamiento \u00b7 mar → altitud extrema',
      readTitle: 'Lo que dice su ubicaci\u00f3n',
      readPending:
        'Si sobrecompensa la altura con la mira \u2014apunta m\u00e1s alto y pierde la zona\u2014 se lee aqu\u00ed cuando llegue la ubicaci\u00f3n. Sin ella no hay lectura: no se inventa.',
      mapLabel: (env: string, n: number): string =>
        `Ubicaci\u00f3n de ${String(n)} lanzamientos en ${env}, vista del c\u00e1tcher`,
      pendingLabel: (env: string): string => `Ubicaci\u00f3n en ${env}: pendiente`,
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
  plan: {
    title: 'Plan de Desarrollo',
    subtitle: 'Qu\u00e9 cambiar de su arsenal para que sobreviva en casa, en orden de impacto.',
    today: 'Stuff+ alt. extrema hoy',
    pitcher: 'Lanzador',
    deficitTitle: (deficit: string): string =>
      `D\u00f3nde se pierde \u00b7 contribuci\u00f3n de cada lanzamiento al d\u00e9ficit de ${deficit} puntos`,
    surplusTitle: 'D\u00f3nde gana \u00b7 contribuci\u00f3n de cada lanzamiento contra el promedio',
    deficitRule: 'uso \u00d7 distancia a 100',
    share: (usage: string, stuff: string): string => `${usage}% \u00b7 Stuff+ ${stuff}`,
    culprit: (pitch: string): string =>
      `Todo el d\u00e9ficit est\u00e1 en un solo lanzamiento: el ${pitch}. El plan no es arreglar todo, es arreglar ese pitch o usarlo menos.`,
    spread: 'El d\u00e9ficit se reparte entre varios lanzamientos.',
    noDeficit: 'No hay d\u00e9ficit: su arsenal rinde por encima del promedio en altitud extrema.',
    labels: { degrades: 'Se degrada', holds: 'Aguanta', changes: 'Qu\u00e9 cambia' },
    degrades: (pitch: string, delta: string, sea: string, hh: string, ivb: string): string =>
      `Su ${pitch} cambia ${delta} puntos de Stuff+ en altitud extrema, de ${sea} a ${hh}. ${ivb}`,
    ivb: (sea: string, hh: string): string => `Su IVB pasa de ${sea}\u2033 a ${hh}\u2033.`,
    holds: (pitch: string, delta: string, sea: string, hh: string, ivb: string): string =>
      `Su ${pitch} cambia ${delta} puntos (${sea} \u2192 ${hh}). ${ivb}`,
    holdsWhy: (ivb: string, worstIvb: string, worst: string): string =>
      `Tiene menos ride que perder: ${ivb}\u2033 de IVB contra ${worstIvb}\u2033 del ${worst}, y el aire delgado se lleva sobre todo el break.`,
    changes: (
      from: string,
      fromBefore: string,
      fromAfter: string,
      to: string,
      before: string,
      after: string,
    ): string =>
      `Bajar el ${from} de ${fromBefore}% a ${fromAfter}% de uso y d\u00e1rselo al ${to} lleva su Stuff+ ponderado en altitud extrema de ${before} a ${after}. Nada cambia en el brazo: solo qu\u00e9 lanza y cu\u00e1ndo.`,
    noShift: (to: string, from: string): string =>
      `Mover uso no lo compensa: el ${to} pierde menos, pero en altitud extrema sigue rindiendo menos que el ${from}. La palanca aqu\u00ed no es el reparto.`,
    shiftBy: 'Mover',
    points: (n: number): string => `${String(n)} pts`,
    tryInSimulator: (pitch: string): string => `Probar el ${pitch} en el Simulador \u2192`,
    none: 'No hay plan que proponer: hace falta al menos dos pitches con score en los dos entornos.',
    limitTitle: 'L\u00edmite del modelo',
    limit:
      'Estas ganancias est\u00e1n en puntos de Stuff+, no en carreras. El puente de Stuff+ a carreras todav\u00eda no existe: construirlo es el trabajo del modelo final (A3), y es lo que convertir\u00eda este plan en carreras. Las bandas suponen que los pitches son muestras independientes.',
  },
  projection: {
    title: 'Proyecci\u00f3n',
    subtitle:
      'C\u00f3mo se ver\u00eda su arsenal en el entorno de la próxima serie, a partir de lo medido a nivel del mar.',
    target: 'Entorno destino',
    targets: {
      hh: (rho: string): string => `Altitud extrema · ρ ${rho}`,
      medium: (rho: string): string => `Altitud media \u00b7 \u03c1 ${rho}`,
    } satisfies Record<Target, (rho: string) => string>,
    physics: (rho: string, factor: string): string =>
      `El aire del destino tiene densidad ${rho} respecto al nivel del mar. El break escala con la densidad medida: cada pulgada de IVB y de break horizontal se multiplica por ${factor}. Velocidad y release no cambian. Es la misma ley que usan el Simulador y el Traductor.`,
    extrapolation:
      'Extrapolaci\u00f3n: la ley y su banda se midieron entre nivel del mar y altitud extrema. En altitud media no hay Stuff+ por lanzador, as\u00ed que aqu\u00ed solo se proyecta la forma.',
    measuredNote:
      'Ya tiene muestra en altitud extrema: la Ficha trae la medici\u00f3n. La columna \u00abmedido\u00bb sirve para ver cu\u00e1nto acierta la proyecci\u00f3n.',
    agreement: (inBand: number, checked: number): string =>
      `${String(inBand)} de ${String(checked)} pitches con muestra en altura caen dentro de la banda al 95% en los dos ejes.`,
    columns: [
      'Pitch',
      'Uso',
      'IVB mar',
      'IVB proyectado',
      'HB mar',
      'HB proyectado',
      'Medido IVB \u00b7 HB',
      'En banda',
    ],
    inBand: 'en banda',
    outOfBand: 'fuera',
    noSample: 'sin muestra',
    note: 'Pulgadas; HB del lado del brazo. El \u00b1 es un error est\u00e1ndar: el error medido de la ley por tipo de pitch, el mismo que muestra el Simulador. \u00abEn banda\u00bb compara lo medido contra la banda al 95%, \u00b11.96 errores, en los dos ejes.',
    none: 'Sin muestra a nivel del mar para proyectar esta temporada.',
  },
  roster: {
    approxTitle: 'Plantel aproximado',
    approx: (n: number, season: number, min: number): string =>
      `El dataset no dice qui\u00e9n es de Diablos. Estos son los ${String(n)} lanzadores que en ${String(season)} lanzaron en altitud extrema la mayor parte de sus lanzamientos (m\u00ednimo ${String(min)} ah\u00ed): quien juega la mitad de sus juegos en casa lanza ah\u00ed la mayor\u00eda, sea abridor o relevista. «Altitud extrema» son cinco parques, así que la lista mezcla lanzadores de esos cinco equipos: el Despliegue y el Plantel son demostrativos, para enseñar cómo se usarían. Se reemplaza por la lista del club cuando la entregue (ADR 0008).`,
    lastScored: 'cada uno en su \u00faltima temporada con score',
  },
  plantel: {
    title: 'Plantel',
    subtitle:
      'Lo que ya tenemos, temporada por temporada. El Radar mira candidatos; esto mira la casa.',
    groupBy: 'Agrupar por',
    groupings: { role: 'Rol', all: 'Todos' } satisfies Record<RosterGrouping, string>,
    howTitle: 'C\u00f3mo leerlo',
    how: (min: number): string =>
      `Una l\u00ednea por lanzador y temporada, no por lanzador: el mismo brazo en dos a\u00f1os son dos mediciones, y la forma cambia m\u00e1s cuando hay un a\u00f1o de hueco (ADR 0005). Donde una temporada no alcanza los ${String(min)} lanzamientos en cada entorno, se dice; no se rellena con el promedio de las otras.`,
    columns: [
      'Pitcher',
      'Mano',
      'Temp.',
      'Rol',
      'Stuff+ alt. extrema',
      'Nivel del mar',
      '\u0394',
      'Pitch principal',
    ],
    unscored: (hh: number, sea: number): string =>
      `${String(hh)} en altitud, ${String(sea)} a nivel del mar`,
    absent: 'no lanz\u00f3',
    summary: (scored: number, unscored: number, pitchers: number): string =>
      `${String(scored)} temporadas con score y ${String(unscored)} sin muestra suficiente, de ${String(pitchers)} lanzadores.`,
    toFicha: 'Cada l\u00ednea con score lleva a su Ficha.',
  },
  deploy: {
    title: 'Despliegue',
    subtitle: (n: number): string =>
      `Los mejores del plantel para el entorno donde se juega. ${String(n)} lanzadores, cada uno en su \u00faltima temporada con score.`,
    stadium: 'Entorno de la serie',
    envs: {
      hh: (rho: string): string => `Altitud extrema · ρ ${rho}`,
      sea: (rho: string): string => `Nivel del mar \u00b7 \u03c1 ${rho}`,
    },
    ruleTitle: 'La regla',
    rule: 'Se ordena por Stuff+ absoluto del entorno elegido, nunca por el \u0394: el \u0394 dice cu\u00e1nto te van a cobrar por \u00e9l, el absoluto dice qui\u00e9n es mejor hoy, aqu\u00ed. Se agrupa por rol porque comparar abridores y relevistas es comparar dos oficios. El orden de pitcheo no se sugiere: eso lo decide el m\u00e1nager, con contexto que este tablero no ve.',
    whyTitle: 'Por qu\u00e9 existe',
    why: (rho: string, move: string, turnover: number, n: number): string =>
      `En los ${String(n)} lanzadores del Radar, el orden en casa y en gira correlaciona ${rho} (Spearman): el cambio mediano es de ${move} posiciones, y ${String(turnover)} de los 10 mejores en casa no est\u00e1n entre los 10 mejores de gira.`,
    noMedium: 'Altitud media no est\u00e1: no hay Stuff+ por lanzador en ese entorno.',
    groupCount: (n: number): string => (n === 1 ? '1 lanzador' : `${String(n)} lanzadores`),
    noRole: 'Sin rol',
    boardTitle: 'Plantel completo y c\u00f3mo cambia el orden entre entornos',
    columns: [
      'Pitcher',
      'Temp.',
      'Mano',
      'Rol',
      'Stuff+ alt. extrema',
      'Nivel del mar',
      'Pos. casa',
      'Pos. gira',
      'Cambio',
      'Pitch principal',
    ],
    moveNote:
      'Cambio: posiciones que gana o pierde al pasar de la gira a casa. La temporada en \u00e1mbar avisa que su dato no es de la temporada m\u00e1s reciente.',
    band: 'Cada Stuff+ con su banda al 95%',
  },
  sim: {
    title: 'Simulador de Pitch',
    subtitle:
      'Parte del pitch real de un lanzador, muévelo y compara lo que vale a nivel del mar y en altitud extrema.',
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
      hh: 'Stuff+ en altitud extrema',
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
        `En altitud extrema el efecto Magnus —lo que mueve la pelota— cae a ${magnus} de su valor a nivel del mar, y todo el break se contrae en esa proporción. El aire también la frena menos (Índice de Densidad ${density}, medido desde la pelota), así que llega más rápida al plato. La velocidad de salida y el spin son del brazo, no del aire: no se tocan.`,
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
      panel: { sea: 'Nivel del mar', hh: 'Altitud extrema' } satisfies Record<Environment, string>,
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
