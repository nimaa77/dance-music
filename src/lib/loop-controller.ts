export type LoopPhase =
  | 'empty'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'waiting'
  | 'error'

export type LoopSettings = {
  start: number
  end: number
  delaySeconds: number
}

type AudioAdapter = {
  currentTime: number
  play: () => Promise<void>
  pause: () => void
}

type LoopCallbacks = {
  onPhaseChange: (phase: LoopPhase) => void
  onError: (error: unknown) => void
}

type LoopScheduler = {
  requestFrame: (callback: FrameRequestCallback) => number
  cancelFrame: (id: number) => void
  setTimer: (callback: () => void, delayMs: number) => number
  clearTimer: (id: number) => void
}

const browserScheduler: LoopScheduler = {
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (id) => window.cancelAnimationFrame(id),
  setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimer: (id) => window.clearTimeout(id),
}

export class LoopController {
  private frameId: number | null = null
  private timerId: number | null = null
  private generation = 0
  private active = false
  private settings: LoopSettings | null = null
  private readonly audio: AudioAdapter
  private readonly callbacks: LoopCallbacks
  private readonly scheduler: LoopScheduler

  constructor(
    audio: AudioAdapter,
    callbacks: LoopCallbacks,
    scheduler: LoopScheduler = browserScheduler,
  ) {
    this.audio = audio
    this.callbacks = callbacks
    this.scheduler = scheduler
  }

  async start(settings: LoopSettings): Promise<void> {
    this.cancelScheduledWork()
    this.generation += 1
    this.active = true
    this.settings = {
      start: Math.max(0, settings.start),
      end: Math.max(settings.start + 1, settings.end),
      delaySeconds: Math.max(0, settings.delaySeconds),
    }
    await this.playCycle(this.generation)
  }

  stop(notify = true): void {
    this.generation += 1
    this.active = false
    this.cancelScheduledWork()
    this.audio.pause()
    if (this.settings) this.audio.currentTime = this.settings.start
    if (notify) this.callbacks.onPhaseChange('ready')
  }

  private async playCycle(generation: number): Promise<void> {
    if (!this.active || generation !== this.generation || !this.settings) return

    this.audio.currentTime = this.settings.start
    this.callbacks.onPhaseChange('playing')

    try {
      await this.audio.play()
      if (!this.active || generation !== this.generation) {
        this.audio.pause()
        return
      }
      this.watchPlayback(generation)
    } catch (error) {
      if (generation !== this.generation) return
      this.active = false
      this.cancelScheduledWork()
      this.audio.pause()
      this.callbacks.onPhaseChange('error')
      this.callbacks.onError(error)
    }
  }

  private watchPlayback(generation: number): void {
    this.frameId = this.scheduler.requestFrame(() => {
      if (!this.active || generation !== this.generation || !this.settings) return

      if (this.audio.currentTime >= this.settings.end - 0.015) {
        this.beginWait(generation)
      } else {
        this.watchPlayback(generation)
      }
    })
  }

  private beginWait(generation: number): void {
    if (!this.settings) return
    this.audio.pause()
    this.frameId = null
    this.callbacks.onPhaseChange('waiting')

    this.timerId = this.scheduler.setTimer(() => {
      this.timerId = null
      void this.playCycle(generation)
    }, this.settings.delaySeconds * 1000)
  }

  private cancelScheduledWork(): void {
    if (this.frameId !== null) {
      this.scheduler.cancelFrame(this.frameId)
      this.frameId = null
    }
    if (this.timerId !== null) {
      this.scheduler.clearTimer(this.timerId)
      this.timerId = null
    }
  }
}
