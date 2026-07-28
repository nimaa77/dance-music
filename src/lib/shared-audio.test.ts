import { describe, expect, it, vi } from 'vitest'
import {
  consumeSharedAudio,
  getShareErrorMessage,
  isSupportedAudioFile,
  storeSharedAudio,
} from './shared-audio'

describe('shared audio', () => {
  it('accepts audio MIME types and common extensions with generic MIME types', () => {
    expect(isSupportedAudioFile(new File([], 'track.bin', { type: 'audio/mpeg' }))).toBe(
      true,
    )
    expect(
      isSupportedAudioFile(
        new File([], 'telegram-track.m4a', { type: 'application/octet-stream' }),
      ),
    ).toBe(true)
    expect(isSupportedAudioFile(new File([], 'track.mp3'))).toBe(true)
  })

  it('rejects unrelated shared files', () => {
    expect(isSupportedAudioFile(new File([], 'notes.txt', { type: 'text/plain' }))).toBe(
      false,
    )
    expect(isSupportedAudioFile(new File([], 'archive.zip'))).toBe(false)
  })

  it('stores, restores, and removes a shared file', async () => {
    const entries = new Map<string, Response>()
    const cache = {
      delete: vi.fn(async (key: string) => entries.delete(key)),
      match: vi.fn(async (key: string) => entries.get(key)),
      put: vi.fn(async (key: string, response: Response) => {
        entries.set(key, response)
      }),
    }
    vi.stubGlobal('caches', {
      open: vi.fn(async () => cache),
    })

    await storeSharedAudio(
      new File(['audio bytes'], 'تمرین.mp3', { type: 'audio/mpeg' }),
    )
    const restored = await consumeSharedAudio()

    expect(restored?.name).toBe('تمرین.mp3')
    expect(restored?.type).toBe('audio/mpeg')
    expect(entries.size).toBe(0)

    vi.unstubAllGlobals()
  })

  it('maps share failures to useful messages', () => {
    expect(getShareErrorMessage('unsupported')).toContain('not a supported audio')
    expect(getShareErrorMessage('storage')).toContain('could not be opened')
    expect(getShareErrorMessage('missing')).toContain('No audio file')
  })
})
