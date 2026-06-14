import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fileUploadField } from '../../domain/testFixtures'
import type { FieldConfigMap, FieldValueMap } from '../../domain'
import { fileUploadDefinition } from './fileUpload'

function Harness() {
  const field = fileUploadField('f1', {
    label: 'Resume',
    config: { acceptedTypes: [], maxFiles: 2 },
  })
  const [config, setConfig] = useState<FieldConfigMap['fileUpload']>(field.config)
  const [value, setValue] = useState<FieldValueMap['fileUpload']>([])

  return (
    <div>
      <fileUploadDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <fileUploadDefinition.FillRenderer
        config={config}
        value={value}
        onChange={setValue}
        label={field.label}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </div>
  )
}

describe('fileUpload field definition', () => {
  it('shows a real label and a note that file content is not stored', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Resume')).toBeInTheDocument()
    expect(screen.getByText(/file content isn't stored/i)).toBeInTheDocument()
  })

  it('adds a file row with name, size and type, and supports removal', async () => {
    render(<Harness />)

    const file = new File(['hello'], 'resume.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Resume'), file)

    expect(screen.getByText('resume.pdf')).toBeInTheDocument()
    expect(screen.getByText('application/pdf')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remove resume.pdf' }))
    expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument()
    expect(screen.getByTestId('value')).toHaveTextContent('[]')
  })

  it('round-trips accepted types and max files from the config editor', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('Accepted file types'), '.pdf, .docx')
    expect(screen.getByLabelText('Resume')).toHaveAttribute('accept', '.pdf,.docx')

    const maxFilesInput = screen.getByLabelText('Maximum files')
    await userEvent.clear(maxFilesInput)
    await userEvent.type(maxFilesInput, '1')
    await userEvent.tab()

    const file = new File(['a'], 'a.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Resume'), file)
    expect(screen.getByLabelText('Resume')).toBeDisabled()
  })

  it('enforces maxFiles via the validation engine', () => {
    const field = fileUploadField('f1', {
      label: 'Resume',
      config: { acceptedTypes: [], maxFiles: 1 },
    })
    const error = fileUploadDefinition.validate(
      field,
      [
        { name: 'a.pdf', size: 1, type: 'application/pdf' },
        { name: 'b.pdf', size: 1, type: 'application/pdf' },
      ],
      { effectiveRequired: false, effectiveVisible: true },
    )
    expect(error?.code).toBe('maxFiles')
  })

  it('has no condition operators and never matches a condition', () => {
    expect(fileUploadDefinition.conditionOperators).toEqual([])
    expect(fileUploadDefinition.evaluateCondition('equals', [], 'x')).toBe(false)
  })

  it('produces a PDF row joining the uploaded file names', () => {
    const field = fileUploadField('f1', { label: 'Resume' })
    expect(
      fileUploadDefinition.toPdfRows(field, [
        { name: 'resume.pdf', size: 10, type: 'application/pdf' },
      ]),
    ).toEqual([{ label: 'Resume', value: 'resume.pdf' }])
    expect(fileUploadDefinition.toPdfRows(field, [])).toEqual([{ label: 'Resume', value: '' }])
  })
})
