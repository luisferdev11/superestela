/**
 * El rail del prototipo, con una diferencia honesta: `href: null` marca la
 * pantalla que todavia no existe. Cuando aterrice, se cambia el `null` por su
 * ruta y el rail se entera solo.
 */
export type NavItem = {
  readonly id: 'radar' | 'roster' | 'deployment' | 'simulator' | 'translator'
  readonly href: '/radar' | '/simulador' | '/despliegue' | null
}

export type NavGroup = {
  readonly id: 'signings' | 'roster' | 'lab'
  readonly items: readonly NavItem[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: 'signings', items: [{ id: 'radar', href: '/radar' }] },
  {
    id: 'roster',
    items: [
      { id: 'roster', href: null },
      { id: 'deployment', href: '/despliegue' },
    ],
  },
  {
    id: 'lab',
    items: [
      { id: 'simulator', href: '/simulador' },
      { id: 'translator', href: null },
    ],
  },
]

/**
 * Las pestanas de la Ficha. Proyeccion y Plan son sus propias pantallas
 * (`docs/10` T4 y T6): se listan, pero no son enlaces hasta que existan.
 */
export type FichaTab = 'summary' | 'arsenal' | 'projection' | 'plan'

export const FICHA_TABS: readonly FichaTab[] = ['summary', 'arsenal', 'projection', 'plan']
