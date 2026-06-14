import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { sectionHeaderField } from '../../domain/testFixtures'
import type { FieldConfigMap } from '../../domain'
import { sectionHeaderDefinition } from './sectionHeader'

function Harness() {
  const field = sectionHeaderField('f1', { label: 'Personal details' })
  const [config, setConfig] = useState<FieldConfigMap['sectionHeader']>(field.config)

  return (
    <div>
      <sectionHeaderDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <sectionHeaderDefinition.FillRenderer
        config={config}
        // sectionHeader captures no value; FillRenderer never reads it.
        value={undefined as never}
        onChange={() => undefined}
        label={field.label}
      />
    </div>
  )
}

describe('sectionHeader field definition', () => {
  it('is not an input field', () => {
    expect(sectionHeaderDefinition.isInput).toBe(false)
  })

  it('renders the label as heading text whose size follows the config', async () => {
    render(<Harness />)

    const heading = screen.getByText('Personal details')
    expect(heading.className).toContain('text-lg')

    await userEvent.selectOptions(screen.getByLabelText('Size'), 'xl')
    expect(heading.className).toContain('text-2xl')
  })

  it('never produces a validation error', () => {
    const field = sectionHeaderField('f1', { label: 'Personal details' })
    expect(
      sectionHeaderDefinition.validate(field, undefined, {
        effectiveRequired: true,
        effectiveVisible: true,
      }),
    ).toBeNull()
  })

  it('has no condition operators and never matches a condition', () => {
    expect(sectionHeaderDefinition.conditionOperators).toEqual([])
    expect(sectionHeaderDefinition.evaluateCondition('equals', undefined, 'x')).toBe(false)
  })

  it('produces no PDF rows', () => {
    const field = sectionHeaderField('f1', { label: 'Personal details' })
    expect(sectionHeaderDefinition.toPdfRows(field, undefined)).toEqual([])
  })
})
