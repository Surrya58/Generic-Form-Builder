import { useParams } from 'react-router-dom'
import { PlaceholderScreen } from './PlaceholderScreen'

export function FillScreen() {
  const { templateId, instanceId } = useParams<{ templateId: string; instanceId: string }>()
  return <PlaceholderScreen title="Fill" params={{ templateId, instanceId }} />
}
