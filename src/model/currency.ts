// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

/**
 * Display currencies for the budget estimator.
 *
 * Every price in the tool is stored in USD — the price table, the per-project
 * overrides and `budget.total` alike — so a project opens with the same numbers
 * whoever made it. Currency is a display choice applied on the way out, and on
 * the way back in when someone types into a field.
 *
 * Rates are indicative and frozen at the date below rather than fetched: an
 * order-of-magnitude estimator should not silently change its own numbers
 * because an FX API moved overnight, and a budgetary estimate carries far more
 * uncertainty than a few percent of currency drift. Override any unit price in
 * the Budget dialog if your market says otherwise.
 */
export interface Currency {
  code: string
  symbol: string
  name: string
  /** Units of this currency per 1 USD. */
  rate: number
  /** Decimal places to show. Currencies with tiny units show none. */
  dp: number
}

export const FX_DATE = '27 Aug 2026'

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US dollar', rate: 1, dp: 0 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.857811, dp: 0 },
  { code: 'GBP', symbol: '£', name: 'Pound sterling', rate: 0.735113, dp: 0 },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', rate: 95.465863, dp: 0 },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', rate: 159.234947, dp: 0 },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese yuan', rate: 6.737816, dp: 0 },
  { code: 'AED', symbol: 'AED ', name: 'UAE dirham', rate: 3.6725, dp: 0 },
  { code: 'SAR', symbol: 'SAR ', name: 'Saudi riyal', rate: 3.75, dp: 0 },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar', rate: 1.393007, dp: 0 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar', rate: 1.387087, dp: 0 },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss franc', rate: 0.805051, dp: 0 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar', rate: 1.270935, dp: 0 },
]

/** Docs saved before currencies had codes stored the bare symbol. */
const LEGACY: Record<string, string> = { $: 'USD', '€': 'EUR', '₹': 'INR', '£': 'GBP', '¥': 'JPY' }

export function currencyOf(code: string | undefined): Currency {
  const want = code ? (LEGACY[code] ?? code) : 'USD'
  return CURRENCIES.find((c) => c.code === want) ?? CURRENCIES[0]!
}

/** USD -> display currency. */
export const toDisplay = (usd: number, cur: Currency): number => usd * cur.rate

/** Display currency -> USD, for values typed into a field. */
export const toUsd = (shown: number, cur: Currency): number => shown / cur.rate

/** Full amount with symbol, e.g. "₹9,54,659" -> "₹954,659". */
export function money(usd: number, cur: Currency): string {
  const v = toDisplay(usd, cur)
  return cur.symbol + v.toLocaleString('en-US', { minimumFractionDigits: cur.dp, maximumFractionDigits: cur.dp })
}

/** Compact amount for the toolbar chip: 12400 -> "12k", 1.3e6 -> "1.3M". */
export function moneyShort(usd: number, cur: Currency): string {
  const v = toDisplay(usd, cur)
  const a = Math.abs(v)
  if (a >= 1e9) return `${cur.symbol}${(v / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`
  if (a >= 1e6) return `${cur.symbol}${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`
  if (a >= 1e4) return `${cur.symbol}${(v / 1e3).toFixed(0)}k`
  if (a >= 1e3) return `${cur.symbol}${(v / 1e3).toFixed(1)}k`
  return cur.symbol + Math.round(v).toLocaleString('en-US')
}

/**
 * Scale units for entering large budgets, so nobody has to count zeros.
 * Indian currencies get lakh/crore, everyone else gets K/M/B.
 */
export interface ScaleUnit {
  label: string
  /** Display-currency units per 1 of this scale. */
  mult: number
  title: string
}

const WESTERN: ScaleUnit[] = [
  { label: '—', mult: 1, title: 'plain units' },
  { label: 'K', mult: 1e3, title: 'thousand' },
  { label: 'M', mult: 1e6, title: 'million' },
  { label: 'B', mult: 1e9, title: 'billion' },
]

const INDIAN: ScaleUnit[] = [
  { label: '—', mult: 1, title: 'plain rupees' },
  { label: 'K', mult: 1e3, title: 'thousand' },
  { label: 'Lakh', mult: 1e5, title: '1 lakh = 1,00,000' },
  { label: 'Cr', mult: 1e7, title: '1 crore = 1,00,00,000 (100 lakh)' },
]

export const scaleUnits = (cur: Currency): ScaleUnit[] => (cur.code === 'INR' ? INDIAN : WESTERN)

/** The largest unit that still leaves a value of 1 or more — what a person would say out loud. */
export function bestScale(shown: number, units: ScaleUnit[]): ScaleUnit {
  const a = Math.abs(shown)
  if (!Number.isFinite(a) || a < 1) return units[0]!
  return [...units].reverse().find((u) => a >= u.mult) ?? units[0]!
}

/** Trim a scaled value for an input: 7.0500 -> "7.05", 60 -> "60". */
export function trimNum(v: number): string {
  if (!Number.isFinite(v)) return ''
  return String(Number(v.toFixed(4)))
}
