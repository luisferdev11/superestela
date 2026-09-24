/**
 * El rail del prototipo, con una diferencia honesta: `href: null` marca la
 * pantalla que todavia no existe. Cuando aterrice, se cambia el `null` por su
 * ruta y el rail se entera solo.
 */
export type NavItem = {
  readonly id: 'radar' | 'roster' | 'deployment' | 'simulator' | 'translator'
  readonly href: '/radar' | '/simulador' | null
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
      { id: 'deployment', href: null },
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
