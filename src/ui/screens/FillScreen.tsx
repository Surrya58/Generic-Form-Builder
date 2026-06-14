import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Field } from '../../domain'
import { FillProvider, type FillInit } from '../../state'
import { FillForm } from '../fill'
import { useRepository } from '../persistence'
import { NotFoundScreen } from './NotFoundScreen'

/** Local calendar date (YYYY-MM-DD) for date prefill — no UTC, to avoid off-by-one. */
function localToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Initial values for a brand-new instance: date fields with prefill-today seeded to today. */
function initialValues(fields: Field[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.type === 'date' && field.config.prefillToday) {
      values[field.id] = localToday()
    }
  }
  return values
}

export function FillScreen() {
  const { templateId, instanceId } = useParams<{ templateId: string; instanceId: string }>()
  const repository = useRepository()

  // Load once: the template, plus any autosaved draft (so a mid-fill refresh
  // restores entered values). Prefill-today applies only when there's no draft.
  const [loaded] = useState(() => {
    if (!templateId || !instanceId) return null
    const templateResult = repository.getTemplate(templateId)
    if (!templateResult.ok || !templateResult.value) return null
    const template = templateResult.value

    const draftResult = repository.getInstanceDraft(instanceId)
    const draftValues =
      draftResult.ok && draftResult.value
        ? (draftResult.value.payload as Record<string, unknown>)
        : null

    return { template, values: draftValues ?? initialValues(template.fields) }
  })

  if (!templateId || !instanceId || !loaded) return <NotFoundScreen />

  const init: FillInit = { templateId, instanceId, values: loaded.values }
  return (
    <FillProvider init={init}>
      <FillForm template={loaded.template} />
    </FillProvider>
  )
}
