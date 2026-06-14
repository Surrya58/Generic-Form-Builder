import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadJson } from './downloadJson'

describe('downloadJson', () => {
  let capturedBlob: Blob | undefined
  let revokeObjectURL: ReturnType<typeof vi.spyOn>
  let click: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    capturedBlob = undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj) => {
      capturedBlob = obj as Blob
      return 'blob:mock-url'
    })
    revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a JSON blob, clicks a download link, and revokes the URL', () => {
    downloadJson({ hello: 'world' }, 'backup.json')

    expect(capturedBlob?.type).toBe('application/json')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
