import { describe, expect, it } from 'vitest'
import {
  buildCalculationDependencyMap,
  compute,
  computeAll,
  getDependentCalculationIds,
} from './calculationEngine'
import { calculationField, numberField } from './testFixtures'

describe('compute', () => {
  it('sums all numeric sources', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'sum' },
    })
    const effectiveValues = new Map<string, unknown>([
      ['n1', 10],
      ['n2', 20],
    ])

    expect(compute(calc, [n1, n2, calc], effectiveValues)).toBe(30)
  })

  it('averages all numeric sources', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'avg' },
    })
    const effectiveValues = new Map<string, unknown>([
      ['n1', 10],
      ['n2', 20],
    ])

    expect(compute(calc, [n1, n2, calc], effectiveValues)).toBe(15)
  })

  it('takes the minimum of all numeric sources', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'min' },
    })
    const effectiveValues = new Map<string, unknown>([
      ['n1', 10],
      ['n2', 20],
    ])

    expect(compute(calc, [n1, n2, calc], effectiveValues)).toBe(10)
  })

  it('takes the maximum of all numeric sources', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'max' },
    })
    const effectiveValues = new Map<string, unknown>([
      ['n1', 10],
      ['n2', 20],
    ])

    expect(compute(calc, [n1, n2, calc], effectiveValues)).toBe(20)
  })

  it('excludes a hidden source (absent from effectiveValues)', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'sum' },
    })
    // n2 is hidden, so getEffectiveValues would never have included it.
    const effectiveValues = new Map<string, unknown>([['n1', 10]])

    expect(compute(calc, [n1, n2, calc], effectiveValues)).toBe(10)
  })

  it('excludes an empty/null source', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'sum' },
    })
    const effectiveValues = new Map<string, unknown>([
      ['n1', 10],
      ['n2', null],
    ])

    expect(compute(calc, [n1, n2, calc], effectiveValues)).toBe(10)
  })

  it('excludes a source that has been deleted from the template', () => {
    const n1 = numberField('n1')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'deleted'], aggregation: 'sum' },
    })
    const effectiveValues = new Map<string, unknown>([['n1', 10]])

    expect(compute(calc, [n1, calc], effectiveValues)).toBe(10)
  })

  it('rejects a source that is itself a calculation field', () => {
    const n1 = numberField('n1')
    const otherCalc = calculationField('other-calc', {
      config: { sourceFieldIds: [], aggregation: 'sum' },
    })
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'other-calc'], aggregation: 'sum' },
    })
    const effectiveValues = new Map<string, unknown>([
      ['n1', 10],
      ['other-calc', 100],
    ])

    expect(compute(calc, [n1, otherCalc, calc], effectiveValues)).toBe(10)
  })

  describe('an empty source set', () => {
    it.each(['sum', 'avg', 'min', 'max'] as const)(
      'returns null for %s, never 0 or NaN',
      (aggregation) => {
        const n1 = numberField('n1')
        const calc = calculationField('calc', { config: { sourceFieldIds: ['n1'], aggregation } })
        const effectiveValues = new Map<string, unknown>([['n1', null]])

        expect(compute(calc, [n1, calc], effectiveValues)).toBeNull()
      },
    )

    it('returns null when there are no source fields at all', () => {
      const calc = calculationField('calc', { config: { sourceFieldIds: [], aggregation: 'sum' } })

      expect(compute(calc, [calc], new Map())).toBeNull()
    })
  })

  it('rounds the aggregated result to the configured decimals', () => {
    const n1 = numberField('n1')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1'], aggregation: 'sum', decimals: 2 },
    })
    const effectiveValues = new Map<string, unknown>([['n1', 10.456]])

    expect(compute(calc, [n1, calc], effectiveValues)).toBe(10.46)
  })

  it('rounds an average to 0 decimals', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'avg', decimals: 0 },
    })
    const effectiveValues = new Map<string, unknown>([
      ['n1', 10],
      ['n2', 15],
    ])

    expect(compute(calc, [n1, n2, calc], effectiveValues)).toBe(13)
  })

  it('throws for an unrecognized aggregation (defensive exhaustiveness guard)', () => {
    const n1 = numberField('n1')
    const calc = calculationField('calc', {
      config: { sourceFieldIds: ['n1'], aggregation: 'bogus' as unknown as 'sum' },
    })
    const effectiveValues = new Map<string, unknown>([['n1', 10]])

    expect(() => compute(calc, [n1, calc], effectiveValues)).toThrow()
  })
})

describe('computeAll', () => {
  it('computes a value for every calculation field and skips other fields', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const c1 = calculationField('c1', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'sum' },
    })
    const c2 = calculationField('c2', { config: { sourceFieldIds: [], aggregation: 'sum' } })
    const effectiveValues = new Map<string, unknown>([
      ['n1', 5],
      ['n2', 10],
    ])

    const results = computeAll([n1, n2, c1, c2], effectiveValues)

    expect(results).toEqual(
      new Map([
        ['c1', 15],
        ['c2', null],
      ]),
    )
  })
})

describe('buildCalculationDependencyMap', () => {
  it('maps each source field to the calculations that depend on it', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const c1 = calculationField('c1', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'sum' },
    })
    const c2 = calculationField('c2', { config: { sourceFieldIds: ['n1'], aggregation: 'avg' } })

    const dependencyMap = buildCalculationDependencyMap([n1, n2, c1, c2])

    expect(dependencyMap.get('n1')).toEqual(new Set(['c1', 'c2']))
    expect(dependencyMap.get('n2')).toEqual(new Set(['c1']))
    expect(dependencyMap.has('n3')).toBe(false)
  })
})

describe('getDependentCalculationIds', () => {
  it('returns the union of dependents for all changed fields, deduplicated', () => {
    const n1 = numberField('n1')
    const n2 = numberField('n2')
    const c1 = calculationField('c1', {
      config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'sum' },
    })
    const c2 = calculationField('c2', { config: { sourceFieldIds: ['n1'], aggregation: 'avg' } })
    const dependencyMap = buildCalculationDependencyMap([n1, n2, c1, c2])

    expect(getDependentCalculationIds(dependencyMap, ['n1'])).toEqual(new Set(['c1', 'c2']))
    expect(getDependentCalculationIds(dependencyMap, ['n2'])).toEqual(new Set(['c1']))
    expect(getDependentCalculationIds(dependencyMap, ['n1', 'n2'])).toEqual(new Set(['c1', 'c2']))
  })

  it('returns an empty set for a field with no dependents', () => {
    const dependencyMap = buildCalculationDependencyMap([numberField('n1')])

    expect(getDependentCalculationIds(dependencyMap, ['n1'])).toEqual(new Set())
  })
})
