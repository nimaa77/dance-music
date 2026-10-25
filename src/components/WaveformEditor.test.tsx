import { createRef } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaveformEditor, type WaveformHandle } from './WaveformEditor'

const mocks = vi.hoisted(() => ({
  ready: (_duration: number) => {},
  loadBlob: vi.fn<() => Promise<void>>(),
  destroy: vi.fn(),
}))

vi.mock('wavesurfer.js', () => ({
  default: {
    create: () => ({
      on: (event: string, callback: (duration: number) => void) => {
        if (event === 'ready') mocks.ready = callback
        return vi.fn()
      },
      getMediaElement: () => null,
      getWidth: () => 600,
      zoom: vi.fn(),
      toggleInteraction: vi.fn(),
      loadBlob: mocks.loadBlob,
      destroy: mocks.destroy,
    }),
  },
}))

vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', () => ({
  default: {
    create: () => ({
      on: () => vi.fn(),
      addRegion: () => ({ start: 0, end: 10, setOptions: vi.fn() }),
    }),
  },
}))

vi.mock('wavesurfer.js/dist/plugins/timeline.esm.js', () => ({
  default: { create: vi.fn() },
}))

function renderEditor() {
  const ref = createRef<WaveformHandle>()
  const onError = vi.fn()
  const onReady = vi.fn()
  const view = render(
    <WaveformEditor
      ref={ref}
      file={new File(['audio'], 'track.wav', { type: 'audio/wav' })}
      disabled={false}
      start={0}
      end={10}
      onReady={onReady}
      onError={onError}
      onRegionChange={vi.fn()}
      onTimeChange={vi.fn()}
      onWaitClockTick={vi.fn()}
    />,
  )
  return { ...view, ref, onError, onReady }
}

beforeEach(() => {
  mocks.loadBlob.mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('WaveSurfer 8 integration', () => {
  it('handles a missing media element during ready and keep-alive playback', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
    const { ref, onReady, onError } = renderEditor()
    act(() => mocks.ready(60))
    await act(async () => ref.current?.startKeepAlive())
    expect(onReady).toHaveBeenCalledWith(60, expect.any(Object))
    expect(onError).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it('does not report load failures from a destroyed player', async () => {
    let rejectLoad!: (reason: Error) => void
    mocks.loadBlob.mockReturnValue(new Promise<void>((_resolve, reject) => {
      rejectLoad = reject
    }))
    const { unmount, onError } = renderEditor()
    unmount()
    await act(async () => rejectLoad(new Error('Player destroyed')))
    expect(mocks.destroy).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('ignores a superseded load AbortError', async () => {
    mocks.loadBlob.mockRejectedValue(new DOMException('Superseded', 'AbortError'))
    const { onError } = renderEditor()
    await act(async () => {})
    expect(onError).not.toHaveBeenCalled()
  })

  it('still reports an active audio load failure', async () => {
    mocks.loadBlob.mockRejectedValue(new Error('Invalid audio'))
    const { onError } = renderEditor()
    await act(async () => {})
    expect(onError).toHaveBeenCalledWith(
      'This audio file could not be opened. Try an MP3, M4A, or WAV file.',
    )
  })
})
