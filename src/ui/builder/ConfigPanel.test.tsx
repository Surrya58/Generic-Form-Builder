import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  makeCondition,
  makeTestTemplate,
  numberField,
  sectionHeaderField,
  singleLineTextField,
  singleSelectField,
} from '../../domain/testFixtures'
import { BuilderProvider, useBuilder, useSelectedField } from '../../state'
import { ConfigPanel } from './ConfigPanel'

/** Selects the template's first field on mount, then renders the ConfigPanel. */
function SelectFirstFieldThenRender() {
  const { state, dispatch } = useBuilder()
  const firstFieldId = state.template.fields[0]?.id

  useEffect(() => {
    if (firstFieldId && state.selectedFieldId !== firstFieldId) {
      dispatch({ type: 'selectField', fieldId: firstFieldId })
    }
  }, [firstFieldId, state.selectedFieldId, dispatch])

  return <ConfigPanel />
}

/** Renders a JSON dump of the currently selected field, for assertions. */
function SelectedFieldProbe() {
  const selected = useSelectedField()
  return <pre data-testid="selected-field">{JSON.stringify(selected)}</pre>
}

describe('ConfigPanel', () => {
  it('prompts to select a field when nothing is selected', () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <ConfigPanel />
      </BuilderProvider>,
    )

    expect(screen.getByText('Select a field to edit its settings.')).toBeInTheDocument()
  })

  it("shows the selected field's type and label", () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <SelectFirstFieldThenRender />
      </BuilderProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Single line text' })).toBeInTheDocument()
    expect(screen.getByLabelText('Label')).toHaveValue('Full name')
  })

  it('edits the label', async () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <SelectFirstFieldThenRender />
        <SelectedFieldProbe />
      </BuilderProvider>,
    )

    await userEvent.clear(screen.getByLabelText('Label'))
    await userEvent.type(screen.getByLabelText('Label'), 'Legal name')
    expect(screen.getByTestId('selected-field')).toHaveTextContent(/"label":"Legal name"/)
  })

  it('toggles hidden-by-default and required', async () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <SelectFirstFieldThenRender />
        <SelectedFieldProbe />
      </BuilderProvider>,
    )

    await userEvent.click(screen.getByLabelText('Hidden by default'))
    expect(screen.getByTestId('selected-field')).toHaveTextContent(/"defaultVisibility":"hidden"/)

    await userEvent.click(screen.getByLabelText('Required'))
    expect(screen.getByTestId('selected-field')).toHaveTextContent(/"defaultRequired":true/)
  })

  it('hides the Required toggle for field types that ignore it', () => {
    const field = sectionHeaderField('a', { label: 'Section' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <SelectFirstFieldThenRender />
      </BuilderProvider>,
    )

    expect(screen.queryByLabelText('Required')).not.toBeInTheDocument()
  })

  it("renders the field type's ConfigEditor", () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <SelectFirstFieldThenRender />
      </BuilderProvider>,
    )

    expect(screen.getByLabelText('Placeholder')).toBeInTheDocument()
  })

  describe('condition editor', () => {
    it('disables "Add condition" when there are no other fields', () => {
      const field = singleLineTextField('a', { label: 'Full name' })
      render(
        <BuilderProvider template={makeTestTemplate([field])}>
          <SelectFirstFieldThenRender />
        </BuilderProvider>,
      )

      expect(screen.getByRole('button', { name: '+ Add condition' })).toBeDisabled()
    })

    it('adds a condition with sensible defaults referencing another field', async () => {
      const a = singleLineTextField('a', { label: 'Full name' })
      const b = numberField('b', { label: 'Age' })
      render(
        <BuilderProvider template={makeTestTemplate([a, b])}>
          <SelectFirstFieldThenRender />
          <SelectedFieldProbe />
        </BuilderProvider>,
      )

      await userEvent.click(screen.getByRole('button', { name: '+ Add condition' }))

      expect(screen.getByLabelText('When')).toHaveTextContent('Age')
      expect(screen.getByLabelText('Operator')).toHaveTextContent('is')
      expect(screen.getByLabelText('Then')).toHaveTextContent('Show this field')
      expect(screen.getByTestId('selected-field')).toHaveTextContent(
        /"conditions":\[\{"id":"[^"]+","targetFieldId":"b","operator":"equals","value":0,"effect":"show"\}\]/,
      )
    })

    it('changing the operator to "is between" switches the value input to a range', async () => {
      const a = singleLineTextField('a', { label: 'Full name' })
      const b = numberField('b', { label: 'Age' })
      render(
        <BuilderProvider template={makeTestTemplate([a, b])}>
          <SelectFirstFieldThenRender />
          <SelectedFieldProbe />
        </BuilderProvider>,
      )

      await userEvent.click(screen.getByRole('button', { name: '+ Add condition' }))
      await userEvent.click(screen.getByLabelText('Operator'))
      await userEvent.click(screen.getByRole('option', { name: 'is between' }))

      expect(screen.getByLabelText('Minimum value')).toBeInTheDocument()
      expect(screen.getByLabelText('Maximum value')).toBeInTheDocument()
      expect(screen.getByTestId('selected-field')).toHaveTextContent(
        /"operator":"withinRange","value":\{"min":0,"max":0\}/,
      )
    })

    it('changing the target field resets the operator and value', async () => {
      const a = singleLineTextField('a', { label: 'Full name' })
      const b = numberField('b', { label: 'Age' })
      const c = singleSelectField('c', {
        label: 'Plan',
        config: { options: [{ id: 'opt-1', label: 'Basic' }], display: 'dropdown' },
      })
      render(
        <BuilderProvider template={makeTestTemplate([a, b, c])}>
          <SelectFirstFieldThenRender />
          <SelectedFieldProbe />
        </BuilderProvider>,
      )

      await userEvent.click(screen.getByRole('button', { name: '+ Add condition' }))
      await userEvent.click(screen.getByLabelText('When'))
      await userEvent.click(screen.getByRole('option', { name: 'Plan' }))

      expect(screen.getByLabelText('Operator')).toHaveTextContent('is')
      expect(screen.getByTestId('selected-field')).toHaveTextContent(
        /"targetFieldId":"c","operator":"equals","value":"opt-1"/,
      )
    })

    it('removes a condition', async () => {
      const a = singleLineTextField('a', {
        label: 'Full name',
        conditions: [
          makeCondition({ targetFieldId: 'b', operator: 'equals', value: 0, effect: 'show' }),
        ],
      })
      const b = numberField('b', { label: 'Age' })
      render(
        <BuilderProvider template={makeTestTemplate([a, b])}>
          <SelectFirstFieldThenRender />
          <SelectedFieldProbe />
        </BuilderProvider>,
      )

      expect(screen.getByText('Condition 1')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Remove condition 1' }))

      expect(screen.queryByText('Condition 1')).not.toBeInTheDocument()
      expect(screen.getByTestId('selected-field')).toHaveTextContent(/"conditions":\[\]/)
    })

    it('only offers show/hide effects for field types that ignore "required"', async () => {
      const a = sectionHeaderField('a', { label: 'Section' })
      const b = numberField('b', { label: 'Age' })
      render(
        <BuilderProvider template={makeTestTemplate([a, b])}>
          <SelectFirstFieldThenRender />
        </BuilderProvider>,
      )

      await userEvent.click(screen.getByRole('button', { name: '+ Add condition' }))
      await userEvent.click(screen.getByLabelText('Then'))

      expect(screen.getByRole('option', { name: 'Show this field' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Hide this field' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'Require this field' })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('option', { name: "Don't require this field" }),
      ).not.toBeInTheDocument()
    })
  })
})
