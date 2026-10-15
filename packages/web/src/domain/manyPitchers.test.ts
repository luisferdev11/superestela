import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MANY_SORT,
  NO_MANY_FILTERS,
  toBand95,
  viewOf,
  type ScoredPitcher,
} from './manyPitchers'

const p = (
  id: string,
  hh: number | null,
  hand = 'Right',
  tax: number | null = 1,
): ScoredPitcher => ({
  pitcherId: id,
  pitcherHand: hand,
  n: 150,
  stuffPlusSea: hh === null ? null : { value: hh + 10, se: 1 },
  stuffPlusHh: hh === null ? null : { value: hh, se: 1 },
  altitudeDelta: hh === null ? null : { value: -10, se: 0.5 },
  projectedTax: tax === null ? null : { value: tax, se: 0.4 },
  whiffPerSwing: null,
})

describe('la tabla de varios lanzadores', () => {
  it('ordena por Stuff+ en altitud de mayor a menor, sin modelo al final', () => {
    const rows = viewOf([p('a', 90), p('b', null), p('c', 105)], NO_MANY_FILTERS, DEFAULT_MANY_SORT)
    expect(rows.map((r) => r.pitcherId)).toEqual(['c', 'a', 'b'])
  })

  it('filtra por mano y por parte del id', () => {
    const all = [p('alpha', 90, 'Left'), p('beta', 95, 'Right'), p('alfa2', 99, 'Left')]
    expect(viewOf(all, { hand: 'Left', query: '' }, DEFAULT_MANY_SORT)).toHaveLength(2)
    expect(viewOf(all, { hand: null, query: 'ALF' }, DEFAULT_MANY_SORT)).toHaveLength(1)
  })

  it('el impuesto ordena de mayor a menor y al reves', () => {
    const all = [p('a', 90, 'Right', 2), p('b', 90, 'Right', 5), p('c', 90, 'Right', null)]
    const desc = viewOf(all, NO_MANY_FILTERS, { key: 'tax', direction: 'desc' })
    const asc = viewOf(all, NO_MANY_FILTERS, { key: 'tax', direction: 'asc' })
    expect(desc.map((r) => r.pitcherId)).toEqual(['b', 'a', 'c'])
    expect(asc.map((r) => r.pitcherId)).toEqual(['a', 'b', 'c'])
  })

  it('el error estandar de la API se muestra como banda al 95%', () => {
    expect(toBand95({ value: 100, se: 2 })).toEqual({ value: 100, se: 3.92 })
    expect(toBand95(null)).toBeNull()
  })
})
