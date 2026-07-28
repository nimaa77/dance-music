import { describe, expect, it } from 'vitest'
import { enablePlaybackAudioSession } from './audio-session'

describe('enablePlaybackAudioSession', () => {
  it('requests playback mode when the browser supports it', () => {
    const audioSession = { type: 'ambient' }

    enablePlaybackAudioSession({ audioSession } as Navigator & {
      audioSession: typeof audioSession
    })

    expect(audioSession.type).toBe('playback')
  })

  it('does not block playback when WebKit rejects the setter', () => {
    const audioSession = {
      get type() {
        return 'ambient'
      },
      set type(_value: string) {
        throw new Error('Not supported')
      },
    }

    expect(() =>
      enablePlaybackAudioSession({ audioSession } as Navigator & {
        audioSession: typeof audioSession
      }),
    ).not.toThrow()
  })
})
