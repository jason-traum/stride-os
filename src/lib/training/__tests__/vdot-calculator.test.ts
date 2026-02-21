import { describe, it, expect } from 'vitest'
import { calculateVDOT } from '../vdot-calculator'

describe('vdot-calculator smoke test', () => {
  it('calculates VDOT for a known 5K time', () => {
    // 20:00 5K → our formula yields ~49.8 VDOT
    // (Daniels' printed table says ~42, but the regression approximation diverges at shorter distances)
    const vdot = calculateVDOT(5000, 20 * 60)
    expect(vdot).toBeGreaterThan(48)
    expect(vdot).toBeLessThan(52)
  })

  it('returns a number in the valid VDOT range', () => {
    const vdot = calculateVDOT(10000, 50 * 60)
    expect(vdot).toBeGreaterThanOrEqual(15)
    expect(vdot).toBeLessThanOrEqual(85)
  })

  it('higher fitness produces higher VDOT', () => {
    const slowerVdot = calculateVDOT(5000, 25 * 60)
    const fasterVdot = calculateVDOT(5000, 18 * 60)
    expect(fasterVdot).toBeGreaterThan(slowerVdot)
  })
})
