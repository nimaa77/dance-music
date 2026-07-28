import { describe, expect, it, vi } from 'vitest'
import { LoopController, type LoopPhase } from './loop-controller'

function createHarness(playImplementation: () => Promise<void> = () => Promise.resolve()) {
  let nextFrameId = 0
  let nextTimerId = 0
  const frames = new Map<number, FrameRequestCallback>()
  const timers = new Map<number, () => void>()
  const phases: LoopPhase[] = []
  const errors: unknown[] = []
  let now = 0
  const audio = {
    currentTime: 0,
    play: vi.fn(playImplementation),
    pause: vi.fn(),
    setMuted: vi.fn(),
    setLoop: vi.fn(),
  }

  const controller = new LoopController(
    audio,
    {
      onPhaseChange: (phase) => phases.push(phase),
      onError: (error) => errors.push(error),
    },
    {
      requestFrame: (callback) => {
        const id = ++nextFrameId
        frames.set(id, callback)
        return id
      },
      cancelFrame: (id) => {
        frames.delete(id)
      },
      setTimer: (callback) => {
        const id = ++nextTimerId
        timers.set(id, callback)
        return id
      },
      clearTimer: (id) => {
        timers.delete(id)
      },
      now: () => now,
    },
  )

  return {
    audio,
    controller,
    errors,
    phases,
    runFrame() {
      const entry = frames.entries().next().value
      if (!entry) throw new Error('No frame scheduled')
      const [id, callback] = entry
      frames.delete(id)
      callback(0)
    },
    runTimer() {
      const entry = timers.entries().next().value
      if (!entry) throw new Error('No timer scheduled')
      const [id, callback] = entry
      timers.delete(id)
      callback()
    },
    pendingTimers: () => timers.size,
    pendingFrames: () => frames.size,
    advanceTime: (milliseconds: number) => {
      now += milliseconds
    },
  }
}

describe('LoopController', () => {
  it('plays the selected segment, waits, and repeats', async () => {
    const harness = createHarness()
    await harness.controller.start({ start: 80, end: 90, delaySeconds: 5 })

    expect(harness.audio.currentTime).toBe(80)
    expect(harness.audio.play).toHaveBeenCalledTimes(1)
    expect(harness.phases).toEqual(['playing'])

    harness.audio.currentTime = 90
    harness.runFrame()
    expect(harness.audio.setMuted).toHaveBeenLastCalledWith(true)
    expect(harness.audio.setLoop).toHaveBeenLastCalledWith(true)
    expect(harness.phases.at(-1)).toBe('waiting')

    harness.runTimer()
    await Promise.resolve()
    expect(harness.audio.currentTime).toBe(80)
    expect(harness.audio.play).toHaveBeenCalledTimes(3)
    expect(harness.phases.at(-1)).toBe('playing')
  })

  it('restarts directly when the delay is zero', async () => {
    const harness = createHarness()
    await harness.controller.start({ start: 10, end: 12, delaySeconds: 0 })
    harness.audio.currentTime = 12
    harness.runFrame()

    await Promise.resolve()
    expect(harness.phases.at(-1)).toBe('playing')
    expect(harness.pendingTimers()).toBe(0)
    expect(harness.audio.play).toHaveBeenCalledTimes(2)
  })

  it('uses native media time updates if animation frames are suspended', async () => {
    const harness = createHarness()
    await harness.controller.start({ start: 20, end: 25, delaySeconds: 3 })

    harness.controller.handleTimeUpdate(25)
    expect(harness.phases.at(-1)).toBe('waiting')

    harness.advanceTime(3000)
    harness.controller.handleTimeUpdate(1)
    await Promise.resolve()

    expect(harness.audio.currentTime).toBe(20)
    expect(harness.audio.setMuted).toHaveBeenLastCalledWith(false)
    expect(harness.phases.at(-1)).toBe('playing')
  })

  it('cancels pending work and resets to the start on stop', async () => {
    const harness = createHarness()
    await harness.controller.start({ start: 25, end: 30, delaySeconds: 4 })
    expect(harness.pendingFrames()).toBe(1)

    harness.controller.stop()
    expect(harness.pendingFrames()).toBe(0)
    expect(harness.pendingTimers()).toBe(0)
    expect(harness.audio.currentTime).toBe(25)
    expect(harness.phases.at(-1)).toBe('ready')
  })

  it('reports a playback failure and returns an error phase', async () => {
    const failure = new Error('blocked')
    const harness = createHarness(() => Promise.reject(failure))
    await harness.controller.start({ start: 0, end: 10, delaySeconds: 5 })

    expect(harness.phases).toEqual(['playing', 'error'])
    expect(harness.errors).toEqual([failure])
    expect(harness.pendingFrames()).toBe(0)
  })
})
