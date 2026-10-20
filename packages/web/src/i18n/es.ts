import type { Environment, Role } from '@/domain/types'
import type { Control, Hand, SimMode } from '@/domain/simulator'
import type { StuffPlusReason } from '@/sources/simulateResponse'
import type { FichaTab } from '@/domain/navigation'
import type { SeasonStatus } from '@/domain/pitcher'
import type { Verdict } from '@/domain/reading'
import type { Target } from '@/domain/projection'
import type { RosterGrouping } from '@/domain/roster'
import type { FileProblem, Origin } from '@/domain/translator'
import type { ScaleKind } from '@/domain/scale'

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
  insufficientSampleShort: 'muestra insuf.',
  handShort: { Right: 'D', Left: 'Z' } as Record<string, string | undefined>,
  handLong: { Right: 'Diestro', Left: 'Zurdo' } as Record<string, string | undefined>,
  inconclusive: 'no concluyente',
  inconclusiveShort: 'no concl.',
  noSampleShort: 'sin muestra',
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
  trapsOnly: 'Solo los que sufren en la altura',
  noMatches: 'Ning\u00fan candidato cumple estos filtros.',
  throws: { Right: 'Diestros', Left: 'Zurdos' } as Record<string, string | undefined>,
  rolePlural: { starter: 'Abridores', reliever: 'Relevistas' } satisfies Record<Role, string>,
  sortBy: 'Ordenar por',
  legend: {
    trap: 'Sufre en la altura \u2014 se ve fuerte a nivel del mar y su Stuff+ cae mucho en altitud extrema.',
    inconclusive: (significant: number, total: number): string =>
      `\u2014 el Impuesto no alcanza significancia: solo ${String(significant)} de ${String(total)} la alcanzan.`,
    stale:
      'Temporada en \u00e1mbar \u2014 su \u00faltimo dato no es de la temporada m\u00e1s reciente.',
    showing: (shown: number, total: number): string =>
      `Mostrando ${String(shown)} de ${String(total)} \u00b7 \u00faltima temporada jugada de cada uno \u00b7 banda al 95%`,
  },
  environment: { hh: 'Stuff+ altitud extrema', sea: 'Stuff+ nivel del mar' },
  scale: {
    league: {
      readingMain: (pitch: string, usage: string, delta: string): string =>
        `Su pitch principal es el ${pitch}, al ${usage}% de uso, y en altitud extrema cambia ${delta} puntos de Stuff+.`,
      degrades: (pitch: string, delta: string, sea: string, hh: string, ivb: string): string =>
        `Su ${pitch} cambia ${delta} puntos de Stuff+ en altitud extrema, de ${sea} a ${hh}. ${ivb}`,
      holds: (pitch: string, delta: string, sea: string, hh: string, ivb: string): string =>
        `Su ${pitch} cambia ${delta} puntos (${sea} \u2192 ${hh}). ${ivb}`,
      deployRule:
        'Se ordena por Stuff+ absoluto del entorno elegido, nunca por el \u0394: el \u0394 dice cu\u00e1nto te van a cobrar por \u00e9l, el absoluto dice qui\u00e9n es mejor hoy, aqu\u00ed. Se agrupa por rol porque comparar abridores y relevistas es comparar dos oficios. El orden de pitcheo no se sugiere: eso lo decide el m\u00e1nager, con contexto que este tablero no ve.',
      deltaHelp: 'Cuánto cambia su Stuff+ al subir a la altitud extrema.',
      stuffPlus:
        'La calidad física de un pitch: velocidad, movimiento, spin y release. Hoy lo da un modelo base (v0), y 100 es el pitch promedio de toda la liga, con los dos entornos juntos: por eso en altitud extrema casi todos bajan.',
    },
    perEnvironment: {
      readingMain: (pitch: string, usage: string, delta: string): string =>
        `Su pitch principal es el ${pitch}, al ${usage}% de uso. Frente a los de cada entorno, su lugar cambia ${delta} puntos de Stuff+ al subir a la altitud extrema.`,
      degrades: (pitch: string, delta: string, sea: string, hh: string, ivb: string): string =>
        `Frente a los de su entorno, su ${pitch} pasa de ${sea} a ${hh}: su lugar cambia ${delta} puntos. ${ivb}`,
      holds: (pitch: string, delta: string, sea: string, hh: string, ivb: string): string =>
        `Su ${pitch} conserva su lugar: cambia ${delta} puntos frente a los de su entorno (${sea} \u2192 ${hh}). ${ivb}`,
      deployRule:
        'Se ordena por el Stuff+ del entorno elegido, nunca por el \u0394: el \u0394 dice cu\u00e1nto cambia su lugar al subir, el Stuff+ del entorno dice qui\u00e9n es mejor aqu\u00ed, frente a los que lanzan aqu\u00ed. Se agrupa por rol porque comparar abridores y relevistas es comparar dos oficios. El orden de pitcheo no se sugiere: eso lo decide el m\u00e1nager, con contexto que este tablero no ve.',
      deltaHelp: 'Cuánto cambia su lugar frente a los de su entorno al subir a la altitud extrema.',
      stuffPlus:
        'La calidad física de un pitch: velocidad, movimiento, spin y release. 100 es el pitch promedio de cada entorno: un 110 en altitud extrema es mejor que los que lanzan ahí.',
    },
  } satisfies Record<
    ScaleKind,
    {
      readonly readingMain: (pitch: string, usage: string, delta: string) => string
      readonly degrades: (p: string, d: string, sea: string, hh: string, ivb: string) => string
      readonly holds: (p: string, d: string, sea: string, hh: string, ivb: string) => string
      readonly deployRule: string
      readonly deltaHelp: string
      readonly stuffPlus: string
    }
  >,
  filterBar: {
    pitch: 'Tipo de pitch',
    throws: 'Mano',
    role: 'Rol',
    season: 'Temporada',
    all: 'Todos',
    pitchOption: (pitch: string, count: number): string => `${pitch} (${String(count)})`,
    search: 'Buscar lanzador',
    searchPlaceholder: 'pitcher_00069',
    clear: 'Limpiar filtros',
    results: (shown: number, total: number): string =>
      `${String(shown)} de ${String(total)} lanzadores`,
    pitchNote: (pitch: string): string =>
      `Todos los que tiran ${pitch} con al menos 25 en altitud extrema, ordenados por el Stuff+ de su ${pitch}. Las columnas de Stuff+, \u0394 y uso son las de ese pitch.`,
  },
  sortHint: 'Haz clic en el nombre de una columna para ordenar; otro clic invierte el orden.',
  taxExplainer:
    'Impuesto de Altitud: cu\u00e1ntas carreras de m\u00e1s permite por cada 9 entradas en altitud extrema, contra nivel del mar, medido en sus propios lanzamientos. Solo se muestra cuando la diferencia es concluyente; si no, dice \u00abno concl.\u00bb.',
  pitchColumns: {
    hh: (pitch: string): string => `${pitch} alt. extrema`,
    sea: (pitch: string): string => `${pitch} n. del mar`,
    pitch: 'Pitch',
    usage: 'Uso',
  },
  columnHelp: [
    'El lanzador, anonimizado. Lleva a su Ficha.',
    'Su última temporada con muestra en los dos entornos. En ámbar si no es la más reciente.',
    'Mano con la que lanza.',
    'Calidad de su arsenal en altitud extrema, ponderada por uso, con su banda al 95%.',
    'La misma medida a nivel del mar.',
    'Carreras de más por 9 entradas en altitud extrema, ± un error estándar. «No concl.» si no es significativo al 95%.',
    'Ponches menos bases por bolas, por cada 100 turnos, en altitud extrema en esa temporada, con su banda al 95%. Es la misma cifra que la Ficha; debajo del mínimo de turnos, «muestra insuf.».',
    'Swings abanicados por cada 100 swings, en altitud extrema en esa temporada, con su banda al 95%. Es la misma cifra que la Ficha; debajo del mínimo de swings, «muestra insuf.».',
    'Abridor o relevista, por cómo entra a los juegos.',
    'El pitch que más usa.',
    'Qué tanto lo usa.',
  ],
  guide: {
    title: 'Cómo leer esta tabla',
    stuffPlusTerm: 'Stuff+',
    insufficient: { term: 'Muestra insuficiente' },
    insufficientText: (pitches: number, pa: number, swings: number): string =>
      `Menos de ${String(pitches)} lanzamientos en un entorno, de ${String(pa)} turnos para K\u2212BB% o de ${String(swings)} swings para el whiff. No se muestra un número con una banda tan ancha que no diga nada.`,
    items: [
      {
        term: 'La banda «±»',
        text: 'Cuánto podría moverse el número con más lanzamientos. En el Radar y la Ficha, el ± del Stuff+ y de las tasas es la banda al 95%; el del Impuesto, el Simulador y el Traductor es un error estándar. Si dos lanzadores se traslapan, no hay diferencia que defender.',
      },
      {
        term: 'Altitud extrema',
        text: 'Cinco parques: Puebla, Ciudad de México, Aguascalientes, Querétaro y León. El aire es más delgado y la pelota se mueve menos.',
      },
      {
        term: 'Impuesto de Altitud',
        text: 'Las carreras de más que permite por cada 9 entradas cuando lanza en altitud extrema, contra lo que permite a nivel del mar. Sale de sus propios lanzamientos en los dos entornos, no del modelo. Si la diferencia no es concluyente al 95%, se dice así en vez de dar un número.',
      },
      {
        term: 'Sufre en la altura ▌',
        text: 'Se ve fuerte a nivel del mar y pierde mucho en la altitud: el mercado lo paga por lo que no va a dar en casa.',
      },
      {
        term: 'K\u2212BB% y Whiff%',
        text: 'Lo que el cuerpo técnico mira primero: ponches menos bases por bolas, y swings abanicados, medidos en altitud extrema. En la altura hasta el contacto débil se vuelve hit; abanicar es lo que aguanta. La Ficha da los dos entornos.',
      },
    ],
  },
  columns: [
    'Pitcher',
    'Temp.',
    'Mano',
    'Stuff+ alt. extrema',
    'Nivel del mar',
    '\u0394',
    'Impuesto c/9 ent.',
    'K\u2212BB% alt. ext.',
    'Whiff% alt. ext.',
    'Rol',
    'Pitch principal',
    'Uso',
  ],
  title: 'Radar de Fichajes',
  subtitle:
    'Candidatos en su \u00faltima temporada jugada, ordenados por su valor en altitud extrema, la de la casa de Diablos.',
  evaluated: 'Evaluados',
  conclusiveTax: 'Impuesto concluyente',
  traps: 'Sufren en la altura',
  outOf: (total: number): string => `de ${String(total)}`,
  trap: 'Sufre en la altura',
  trapDescription: 'Se ve fuerte a nivel del mar y su Stuff+ cae mucho en altitud extrema.',
  ficha: {
    breadcrumb: 'Fichajes',
    season: 'Temporada',
    onlySeason: 'Única temporada con muestra en los dos entornos.',
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
      runs: 'Carreras permitidas c/9 ent.',
      runsIn: { hh: 'alt. extrema', sea: 'nivel del mar' } satisfies Record<Environment, string>,
      runsNote: (minInnings: number): string =>
        `RA/9 con banda al 95%, mínimo ${String(minInnings)} entradas. No es ERA: el dataset no marca carreras limpias.`,
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
      hh: 'altitud extrema',
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
      lever: (best: string, bestDelta: string, worst: string, worstDelta: string): string =>
        `Si lo fichas, ap\u00f3yate en su ${best}: es el pitch que menos pierde en la altura (${bestDelta} puntos de Stuff+), contra ${worstDelta} de su ${worst}. En casa, ese pitch es el que conviene usar m\u00e1s.`,
      rule: 'Regla provisional de producto: si sufre en la altura, no al precio de nivel del mar; banda completa del Stuff+ en altitud extrema arriba de 100, fichar; lo dem\u00e1s, con reservas. El veredicto final lo respalda el modelo del equipo de datos.',
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
        'Aqu\u00ed va d\u00f3nde pone sus lanzamientos en cada entorno, su altura media, su porcentaje en zona y su whiff.',
      readTitle: 'Lo que dice su ubicaci\u00f3n',
      readPending:
        'Si sobrecompensa la altura con la mira \u2014apunta m\u00e1s alto y pierde la zona\u2014 se lee aqu\u00ed cuando llegue la ubicaci\u00f3n. Sin ella no hay lectura: no se inventa.',
      mapLabel: (env: string, n: number): string =>
        `Ubicaci\u00f3n de ${String(n)} lanzamientos en ${env}, vista del c\u00e1tcher`,
      pendingLabel: (env: string): string => `Ubicaci\u00f3n en ${env}: pendiente`,
    },
    outcomes: {
      title: 'Ponches, bases por bolas y swings abanicados',
      subtitle:
        'Lo que Diablos mira primero: en la altura hasta el contacto débil se vuelve hit, y abanicar es lo que aguanta.',
      columns: ['Temporada', 'Entorno', 'Turnos', 'K%', 'BB%', 'K\u2212BB%', 'Whiff por swing'],
      environment: { hh: 'Altitud extrema', sea: 'Nivel del mar' } satisfies Record<
        Environment,
        string
      >,
      league: (env: string, kbb: string, whiff: string): string =>
        `Liga en ${env}: K\u2212BB% ${kbb}, whiff por swing ${whiff}.`,
      rule: (pa: number, swings: number): string =>
        `${String(pa)} turnos para K% y BB%, ${String(swings)} swings para el whiff. Banda al 95%. Es conteo, no modelo.`,
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
    ivb: (sea: string, hh: string): string => `Su IVB pasa de ${sea}\u2033 a ${hh}\u2033.`,
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
      'Estas ganancias est\u00e1n en puntos de Stuff+, no en carreras. El puente de Stuff+ a carreras todav\u00eda no existe: construirlo es el trabajo del modelo final, y es lo que convertir\u00eda este plan en carreras. Las bandas suponen que los pitches son muestras independientes.',
  },
  projection: {
    title: 'Proyecci\u00f3n',
    subtitle:
      'C\u00f3mo se ver\u00eda su arsenal en el entorno de la próxima serie, a partir de lo medido a nivel del mar.',
    purpose: {
      title: 'Para qué sirve',
      items: [
        '¿La física de la altura predice bien a este lanzador? Toma lo que mide a nivel del mar y lo traslada a la altitud con la misma ley que usan el Simulador y el Traductor.',
        'Si lo que de verdad midió en la altura cae «en banda», la ley funciona para él, y el Traductor es confiable para lanzadores parecidos que nunca han pitcheado aquí.',
        'Antes de una serie en altura, dice cuánto movimiento va a perder cada pitch y cuál conserva más.',
      ],
    },
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
      'Uso (mar)',
      'IVB a nivel del mar',
      'IVB proyectado',
      'Break horiz. a nivel del mar',
      'Break horiz. proyectado',
      'Medido en altura (IVB \u00b7 HB)',
      '\u00bfAcert\u00f3?',
    ],
    inBand: 's\u00ed, en banda',
    outOfBand: 'no, fuera',
    noSample: 'sin muestra',
    note: 'Pulgadas; HB del lado del brazo. El \u00b1 es un error est\u00e1ndar: el error medido de la ley por tipo de pitch, el mismo que muestra el Simulador. \u00abEn banda\u00bb compara lo medido contra la banda al 95%, \u00b11.96 errores, en los dos ejes.',
    none: 'Sin muestra a nivel del mar para proyectar esta temporada.',
  },
  roster: {
    approxTitle: 'Plantel aproximado',
    approx: (n: number, season: number, min: number): string =>
      `El dataset no dice qui\u00e9n es de Diablos. Estos son los ${String(n)} lanzadores que en ${String(season)} lanzaron en altitud extrema la mayor parte de sus lanzamientos (m\u00ednimo ${String(min)} ah\u00ed): quien juega la mitad de sus juegos en casa lanza ah\u00ed la mayor\u00eda, sea abridor o relevista. «Altitud extrema» son cinco parques, así que la lista mezcla lanzadores de esos cinco equipos: el Despliegue y el Plantel son demostrativos, para enseñar cómo se usarían. Se reemplaza por la lista del club si la entrega.`,
  },
  plantel: {
    title: 'Plantel',
    subtitle:
      'Lo que ya tenemos, temporada por temporada. El Radar mira candidatos; esto mira la casa.',
    groupBy: 'Agrupar por',
    groupings: { role: 'Rol', all: 'Todos' } satisfies Record<RosterGrouping, string>,
    howTitle: 'C\u00f3mo leerlo',
    how: (min: number): string =>
      `Una l\u00ednea por lanzador y temporada, no por lanzador: el mismo brazo en dos a\u00f1os son dos mediciones, y la forma cambia m\u00e1s cuando hay un a\u00f1o de hueco. Donde una temporada no alcanza los ${String(min)} lanzamientos en cada entorno, se dice; no se rellena con el promedio de las otras.`,
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
      legend: {
        more: 'más whiff que la media',
        less: 'menos whiff que la media',
        most: '10% más efectivos',
        least: '10% menos efectivos',
        simulated: 'el pitch simulado',
      },
      zone: (env: string, whiff: string, reference: string): string =>
        `${env}: la liga hace ${whiff} de whiff por swing en esta zona (media del tipo a nivel del mar: ${reference}).`,
      noZone: (env: string): string =>
        `${env}: la liga casi no lanza esta forma; no hay muestra en la zona.`,
      label: (pitchType: string, env: string, ivb: string, hb: string): string =>
        `Mapa de movimiento de ${pitchType} en ${env}. El pitch simulado cae en IVB ${ivb} y break horizontal ${hb} pulgadas.`,
      showExtremes: 'Mostrar los pitches más y menos efectivos de la liga',
      help: {
        open: '¿Cómo leer este mapa?',
        eyebrow: 'Antes de la física',
        title: 'Cómo leer un mapa de movimiento',
        close: 'Cerrar',
        intro:
          'Todos los mapas de la app hablan el mismo idioma. Imagina que estás parado detrás del lanzador, mirando hacia el plato: esa es la «vista del lanzador», y es la que usamos siempre.',
        behind: {
          title: 'Detrás de un lanzador diestro',
          leftBatter: 'bateador zurdo',
          rightBatter: 'bateador diestro',
          glove: '◂ guante',
          arm: 'brazo ▸',
          throwingArm: 'brazo de lanzar',
          gloveHand: 'guante',
          rises: 'sube',
        },
        plane: {
          title: 'El plano de movimiento',
          rises: 'sube (IVB +)',
          drops: 'cae (IVB −)',
          glove: '◂ guante',
          arm: 'brazo ▸',
        },
        items: [
          {
            term: 'Brazo, guante y sube.',
            text: '«Brazo» es el lado del brazo con el que lanza; «guante», el contrario. Para un diestro, el lado del brazo es donde se para el bateador diestro: por eso su recta «se le mete» a ese bateador. Un zurdo se refleja, para que los dos se lean igual.',
          },
          {
            term: 'Cada punto es una forma.',
            text: 'Cuánto se mueve de lado (break horizontal, HB) y cuánto sube o cae (IVB), en pulgadas, contra lo que haría sin spin. Arriba a la derecha vive la recta; abajo a la izquierda, la curva.',
          },
          {
            term: 'Del mar a la altura.',
            text: 'Donde hay dos puntos unidos por una línea, uno es la forma a nivel del mar y el otro en altitud extrema. El aire delgado encoge el movimiento: la forma se acerca al centro.',
          },
          {
            term: 'El fondo de color',
            text: 'En el Simulador, es el whiff por swing que la liga logra con cada forma: azul, más que la media; naranja, menos. Los puntos negros y huecos son el 10% de pitches más y menos efectivos.',
          },
        ],
      },
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
      toggle: 'Ver pitchers reales con una forma parecida',
      title: 'Los pitches reales más parecidos',
      row: (id: string, season: number, n: number): string =>
        `${id} · ${String(season)} · ${String(n)} pitches`,
      whiff: (value: string): string => `${value} whiff`,
    },
    provenance: (modelId: string, passed: number, total: number, usesArsenal: boolean): string =>
      `Stuff+ del modelo ${modelId} · pasó ${String(passed)} de ${String(total)} compuertas · ${usesArsenal ? 'usa' : 'no usa'} el arsenal.`,
    provenanceUnpublished: (modelId: string): string =>
      `Stuff+ del modelo ${modelId} · sus compuertas no están publicadas en analysis/outputs/simulator_validation.json.`,
  },
  translator: {
    title: 'Traductor de Altitud',
    subtitle:
      'Para lanzadores de otras ligas, que no están en nuestros datos: un agente libre, alguien de MLB o de Japón. Entra su arsenal, medido donde se haya medido; sale cómo se movería en altitud extrema y cuánto valdría.',
    modes: {
      label: 'Qué traducir',
      single: 'Un lanzador',
      many: 'Varios lanzadores',
    },
    many: {
      upload: 'Subir un archivo con varios lanzadores',
      hint: 'Un CSV en el formato del dataset: un renglón por lanzamiento, con pitcher_anon_id, las columnas de TrackMan y, si vienen, is_swing e is_whiff para el whiff. El equipo de datos convierte otros exports a este formato.',
      reading: 'Puntuando a cada lanzador…',
      summary: (pitchers: number, rows: string): string =>
        `${String(pitchers)} lanzadores puntuados de ${rows} lanzamientos.`,
      left: (few: number, min: number, unsupported: string, missing: string): string =>
        `Fuera de la tabla: ${String(few)} lanzadores con menos de ${String(min)} lanzamientos, ${unsupported} lanzamientos de tipos sin modelo y ${missing} con datos incompletos.`,
      noSwings: 'El archivo no trae is_swing ni is_whiff: no hay whiff que medir.',
      hidden:
        'El modelo no está publicado para mostrarse: sin Stuff+ ni Impuesto proyectado, solo conteos y whiff.',
      search: 'Buscar lanzador',
      hand: 'Mano',
      all: 'Todas',
      columns: [
        'Pitcher',
        'Mano',
        'Lanzamientos',
        'Stuff+ nivel del mar',
        'Stuff+ alt. extrema',
        '\u0394',
        'Whiff (su liga)',
        'Impuesto proyectado c/9 ent.',
      ],
      columnHelp: [
        'El lanzador, como viene en el archivo.',
        'Mano con la que lanza.',
        'Lanzamientos suyos que se pudieron puntuar.',
        'Su Stuff+ llevado al nivel del mar, con la banda al 95%.',
        'El mismo arsenal trasladado a altitud extrema con la ley de densidad, con la banda al 95%.',
        'Cuánto cambia su Stuff+ al subir a la altitud extrema.',
        'Swings abanicados por cada 100 swings, medidos en su liga, no en la altura. Banda al 95%.',
        'Carreras de más por 9 entradas que el modelo proyecta en altitud extrema. Proyectado, no medido.',
      ],
      taxNote: (n: number, r: string, projected: string, measured: string): string =>
        `Impuesto proyectado: lo que el modelo espera que pierda en carreras por 9 entradas al subir, no lo que se midió. Revisado contra los ${String(n)} lanzadores del Radar que sí lanzaron en los dos entornos: en promedio coincide (${projected} contra ${measured} carreras c/9 ent.), pero lanzador por lanzador ordena poco (r = ${r}). Úsalo como referencia de liga, no para elegir entre dos lanzadores.`,
      taxNoteUnchecked:
        'Impuesto proyectado: lo que el modelo espera que pierda en carreras por 9 entradas al subir, no lo que se midió. Todavía no se ha revisado contra el medido.',
      band: 'Banda al 95% en Stuff+, \u0394 e Impuesto; el whiff lleva la suya.',
      empty: 'Ning\u00fan lanzador del archivo cumple estos filtros.',
    },
    upload: {
      label: 'Subir su export de TrackMan',
      hint: 'Un CSV con un renglón por lanzamiento y las columnas de TrackMan: AutoPitchType, PitcherThrows, RelSpeed, InducedVertBreak, HorzBreak, SpinRate, SpinAxis, Extension, RelHeight y RelSide. Si trae altitude_category, de ahí sale dónde se midió.',
      manual: 'O captura el arsenal a mano en la tabla.',
      reading: 'Leyendo el archivo…',
      loaded: (name: string, used: string, types: string): string =>
        `${name}: ${used} lanzamientos en ${types} tipos de pitch.`,
      left: (unsupported: string, missing: string): string =>
        `Fuera del arsenal: ${unsupported} de tipos que el modelo no puntúa y ${missing} con datos incompletos.`,
      unsupportedTypes: (types: string): string => `Tipos sin modelo: ${types}.`,
      omittedTypes: (types: string): string =>
        `Solo caben seis tipos; quedaron fuera los menos usados: ${types}.`,
      extreme:
        'Este archivo ya se midió en altitud extrema: el Traductor es para quien no ha lanzado ahí. Su Ficha lo mide directamente.',
      problems: {
        unreadable: 'El archivo no se pudo leer como CSV.',
        empty: 'El archivo no trae lanzamientos.',
        missing_columns: 'Faltan columnas de TrackMan:',
        mixed_pitchers: 'El archivo mezcla lanzadores: sube uno por lanzador.',
        mixed_hands: 'La mano del lanzador (PitcherThrows) debe ser una sola, Right o Left.',
        too_many_pitchers:
          'El archivo trae demasiados lanzadores para una pantalla: div\u00eddelo en partes de hasta 400.',
        tooLarge: 'El archivo pasa de 10 MB: sube una temporada de un lanzador.',
        unreachable: 'No se pudo contactar a la API para leer el archivo.',
      } satisfies Record<FileProblem | 'tooLarge' | 'unreachable', string>,
    },
    example: {
      load: 'Cargar el ejemplo de validación',
      title: 'Validación con un lanzador real',
      lead: (id: string, season: string): string =>
        `${id} lanzó en ${season} a nivel del mar y en altitud extrema. Su arsenal del mar entra al Traductor como si fuera de fuera; lo proyectado se compara con lo que se midió en la altura.`,
      columns: [
        'Pitch',
        'IVB proyectado',
        'IVB medido',
        'HB proyectado',
        'HB medido',
        'Medidos',
        'Dentro de la banda',
      ],
      within: 'sí',
      outside: 'no',
      noSample: 'sin muestra',
      note: 'Pulgadas; HB del lado del brazo. Dentro de la banda: lo medido cae en la banda al 95% de lo proyectado en los dos ejes. Con menos de 30 lanzamientos en la altura no se juzga.',
      ficha: '¿Ya juega en la LMB? → su Ficha',
    },
    origin: 'Dónde se midió',
    origins: {
      sea: (rho: string): string => `Nivel del mar · ρ ${rho}`,
      medium: (rho: string): string => `Altitud media · ρ ${rho}`,
    } satisfies Record<Origin, (rho: string) => string>,
    originNote: (rho: string, factor: string): string =>
      `El aire en altitud extrema tiene densidad ${rho} respecto al nivel del mar. Desde donde se midió, cada pulgada de IVB y de break horizontal se multiplica por ${factor}. Velocidad, spin y release son del brazo: no cambian.`,
    extrapolation:
      'Extrapolación: la ley y su banda se midieron entre nivel del mar y altitud extrema. Desde altitud media, la banda suma las dos traslaciones y es conservadora.',
    kpi: {
      sea: 'Stuff+ a nivel del mar',
      hh: 'Stuff+ en altitud extrema',
      delta: 'Δ por altitud',
      weighted:
        'Arsenal ponderado por uso. La banda supone pitches independientes; comparten modelo, así que es optimista.',
      none: 'sin score',
    },
    editor: {
      title: 'Arsenal medido',
      pitch: 'Pitch',
      usage: 'Uso %',
      short: {
        releaseSpeed: 'Velo',
        ivb: 'IVB',
        horizontalBreak: 'HB',
        extension: 'Ext.',
        releaseHeight: 'Altura',
        releaseSide: 'Lado',
        spinRate: 'Spin',
        spinAxis: 'Eje',
      } satisfies Record<Control, string>,
      add: 'Agregar pitch',
      remove: (pitch: string): string => `Quitar ${pitch}`,
      outOfRange: 'Hay valores fuera de lo que se lanza: revisa las celdas marcadas.',
      badUsage: 'El uso de cada pitch va de 0 a 100.',
      duplicate: 'Cada tipo de pitch va una sola vez.',
      noUsage: 'Captura el uso de al menos un pitch.',
      note: 'Velocidad en mph; break en pulgadas y lado en pies, positivos hacia el brazo que lanza; spin en rpm; eje en grados.',
    },
    results: {
      title: 'Traducción por lanzamiento',
      columns: [
        'Pitch',
        'Uso',
        'IVB mar → alt. extrema',
        'HB mar → alt. extrema',
        'Stuff+ mar',
        'Stuff+ alt. extrema',
        'Δ',
        'Vs. su recta, en altitud',
      ],
      anchor: 'es la recta',
      noFastball: 'sin recta',
      versusFastball: (velo: string, ivb: string): string => `${velo} mph · ${ivb}″`,
      unusual: 'forma inusual',
      unusualNote:
        'Marcado como forma inusual: esa combinación no se ha lanzado en la LMB, y su Stuff+ es una extrapolación.',
      openInSimulator: 'Abrir en el Simulador',
      note: 'Pulgadas; HB del lado del brazo. El ± es un error estándar: el de la ley por tipo de pitch, el mismo que muestra el Simulador. El Stuff+ es el del Simulador para la misma forma.',
    },
    map: {
      sea: 'a nivel del mar',
      hh: 'proyectado en altitud extrema',
      note: 'Forma proyectada con la ley de densidad, no medida. Break horizontal del lado del brazo.',
    },
    noRuns: 'El Traductor no imprime carreras: el puente de Stuff+ a carreras todavía no existe.',
  },
} as const
