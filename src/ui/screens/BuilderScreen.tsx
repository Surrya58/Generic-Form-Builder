import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Template } from '../../domain'
import { CURRENT_SCHEMA_VERSION } from '../../persistence'
import { BuilderProvider } from '../../state'
import { BuilderShell } from '../builder'
import { useRepository } from '../persistence'
import { NotFoundScreen } from './NotFoundScreen'

function createBlankTemplate(id: string): Template {
  const now = new Date().toISOString()
  return {
    id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: '',
    fields: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function BuilderScreen() {
  const { templateId } = useParams<{ templateId: string }>()
  const repository = useRepository()

  // Load once on mount: the saved template (or a fresh blank one), plus any
  // autosaved draft so a mid-edit refresh restores the in-progress work.
  const [loaded] = useState(() => {
    if (!templateId) return null
    const saved = repository.getTemplate(templateId)
    const template = saved.ok && saved.value ? saved.value : createBlankTemplate(templateId)
    const draftResult = repository.getTemplateDraft(templateId)
    const draftTemplate =
      draftResult.ok && draftResult.value ? (draftResult.value.payload as Template) : undefined
    return { template, draftTemplate }
  })

  if (!templateId || !loaded) return <NotFoundScreen />

  return (
    <BuilderProvider template={loaded.template} draftTemplate={loaded.draftTemplate}>
      <BuilderShell />
    </BuilderProvider>
  )
}
