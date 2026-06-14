import { useParams } from 'react-router-dom'
import { PlaceholderScreen } from './PlaceholderScreen'

export function InstancesListScreen() {
  const { templateId } = useParams<{ templateId: string }>()
  return <PlaceholderScreen title="Instances" params={{ templateId }} />
}
