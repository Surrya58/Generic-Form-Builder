import { useMemo } from 'react'
import { createLocalStorageAdapter } from '../../persistence'
import { StorageUnavailableBanner, useStorageAvailability } from '../persistence'
import { BuilderHeader } from './BuilderHeader'
import { Canvas } from './Canvas'
import { ConfigPanel } from './ConfigPanel'
import { FieldPalette } from './FieldPalette'

/** The three-panel Builder layout: palette, canvas, and field-settings panel under the header. */
export function BuilderShell() {
  const adapter = useMemo(() => createLocalStorageAdapter(), [])
  const storage = useStorageAvailability(adapter)

  return (
    <div className="flex h-screen flex-col">
      <StorageUnavailableBanner visible={storage === 'unavailable'} />
      <BuilderHeader />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 shrink-0 overflow-y-auto border-r border-gray-200">
          <FieldPalette />
        </div>
        <Canvas />
        <div className="w-80 shrink-0 overflow-y-auto border-l border-gray-200">
          <ConfigPanel />
        </div>
      </div>
    </div>
  )
}
