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

  const [template] = useState<Template | null>(() => {
    if (!templateId) return null
    const result = repository.getTemplate(templateId)
    if (result.ok && result.value) return result.value
    return createBlankTemplate(templateId)
  })

  if (!templateId || !template) return <NotFoundScreen />

  return (
    <BuilderProvider template={template}>
      <BuilderShell />
    </BuilderProvider>
  )
}
