import { Link } from 'react-router-dom'
import { useBuilder } from '../../state'
import { Canvas } from './Canvas'
import { ConfigPanel } from './ConfigPanel'
import { FieldPalette } from './FieldPalette'

/** The three-panel Builder layout: palette, canvas, and field-settings panel under a title header. */
export function BuilderShell() {
  const { state, dispatch } = useBuilder()

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-gray-200 px-4 py-3">
        <Link
          to="/"
          className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          ← Templates
        </Link>
        <input
          aria-label="Template title"
          value={state.template.title}
          onChange={(event) => dispatch({ type: 'setTitle', title: event.target.value })}
          placeholder="Untitled form"
          className="flex-1 rounded-md border border-transparent px-2 py-1 text-lg font-semibold text-gray-900 hover:border-gray-200 focus:border-blue-500 focus:outline-none"
        />
      </header>
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
