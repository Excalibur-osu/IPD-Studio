import { describe, expect, it } from 'vitest'
import {
  bestScale, currencyOf, money, moneyShort, scaleUnits, toDisplay, toUsd, trimNum,
} from '../../src/model/currency'

const INR = currencyOf('INR')
const USD = currencyOf('USD')

describe('currency lookup', () => {
  it('accepts codes and the legacy bare symbols saved by older docs', () => {
    expect(currencyOf('INR').code).toBe('INR')
    expect(currencyOf('₹').code).toBe('INR')
    expect(currencyOf('$').code).toBe('USD')
    expect(currencyOf(undefined).code).toBe('USD')
    expect(currencyOf('nonsense').code).toBe('USD')
  })
})

describe('conversion round-trips', () => {
  it('USD is the stored unit and survives a round trip', () => {
    expect(toUsd(toDisplay(9500, INR), INR)).toBeCloseTo(9500, 6)
    expect(toDisplay(9500, USD)).toBe(9500)
  })
  it('formats with the right symbol', () => {
    expect(money(9500, USD)).toBe('$9,500')
    expect(money(9500, INR)).toBe('₹906,926')
    expect(moneyShort(647750, USD)).toBe('$648k')
    expect(moneyShort(647750, INR)).toBe('₹62M')
  })
})

describe('lakh / crore entry', () => {
  it('offers Indian units for rupees and K/M/B otherwise', () => {
    expect(scaleUnits(INR).map((u) => u.label)).toEqual(['—', 'K', 'Lakh', 'Cr'])
    expect(scaleUnits(USD).map((u) => u.label)).toEqual(['—', 'K', 'M', 'B'])
  })
  it('7.05 Cr means 7,05,00,000 rupees', () => {
    const cr = scaleUnits(INR).find((u) => u.label === 'Cr')!
    expect(7.05 * cr.mult).toBe(70_500_000)
    // and that is what gets stored, in USD
    expect(toDisplay(toUsd(7.05 * cr.mult, INR), INR)).toBeCloseTo(70_500_000, 4)
  })
  it('picks the unit a person would say out loud', () => {
    const u = scaleUnits(INR)
    expect(bestScale(70_500_000, u).label).toBe('Cr')
    expect(bestScale(500_000, u).label).toBe('Lakh')
    expect(bestScale(5_000, u).label).toBe('K')
    expect(bestScale(500, u).label).toBe('—')
    expect(bestScale(0, u).label).toBe('—') // no budget set yet
  })
  it('round-trips a scaled value back into the field without drift', () => {
    const cr = scaleUnits(INR).find((u) => u.label === 'Cr')!
    const usd = toUsd(7.05 * cr.mult, INR)
    expect(trimNum(toDisplay(usd, INR) / cr.mult)).toBe('7.05')
  })
  it('trims trailing zeros but keeps real decimals', () => {
    expect(trimNum(60)).toBe('60')
    expect(trimNum(7.0500)).toBe('7.05')
    expect(trimNum(1.5)).toBe('1.5')
  })
})
