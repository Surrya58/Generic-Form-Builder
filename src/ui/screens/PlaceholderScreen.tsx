interface PlaceholderScreenProps {
  title: string
  params?: Record<string, string | undefined>
}

/** Generic placeholder shown for routes that don't have a real screen yet. */
export function PlaceholderScreen({ title, params }: PlaceholderScreenProps) {
  const entries = Object.entries(params ?? {})

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {entries.length > 0 && (
        <dl className="mt-2 space-y-1 text-sm text-slate-500">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="font-mono">{key}:</dt>
              <dd className="font-mono">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
