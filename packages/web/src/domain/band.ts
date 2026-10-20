import type { Metric } from './types'

/**
 * Every «±» in the product is the 95% half-width (`docs/12` §2.1, decided on
 * 1 October). Sources that deliver a standard error convert it here, at the
 * boundary, so no component ever shows an SE as «±».
 */
export const Z95 = 1.96

/** A standard error as the 95% half-width the screens show. */
export const halfWidth95 = (se: number): number => Z95 * se

/** A metric whose `se` is a standard error, as one whose `se` is the 95% half-width. */
export const toBand95 = (metric: Metric): Metric => ({
  value: metric.value,
  se: halfWidth95(metric.se),
})
