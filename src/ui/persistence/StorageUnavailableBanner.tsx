export interface StorageUnavailableBannerProps {
  visible: boolean
}

/**
 * Warns the user up front that nothing in this session will be saved,
 * e.g. because browser storage is blocked by private browsing mode.
 */
export function StorageUnavailableBanner({ visible }: StorageUnavailableBannerProps) {
  if (!visible) return null

  return (
    <div
      role="alert"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
    >
      Browser storage is unavailable, so changes won&apos;t be saved. This can happen in private
      browsing mode or when storage is disabled — your work will be lost if you close this tab.
    </div>
  )
}
