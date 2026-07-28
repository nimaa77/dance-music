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
  setMuted: (muted: boolean) => void
  setLoop: (loop: boolean) => void
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
  now: () => number
}

const browserScheduler: LoopScheduler = {
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (id) => window.cancelAnimationFrame(id),
  setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimer: (id) => window.clearTimeout(id),
  now: () => Date.now(),
}

export class LoopController {
  private frameId: number | null = null
  private timerId: number | null = null
  private generation = 0
  private active = false
  private settings: LoopSettings | null = null
  private phase: LoopPhase = 'ready'
  private waitingUntil = 0
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
    this.audio.setLoop(false)
    this.audio.setMuted(false)
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
    this.waitingUntil = 0
    this.audio.setLoop(false)
    this.audio.setMuted(false)
    this.audio.pause()
    if (this.settings) this.audio.currentTime = this.settings.start
    this.phase = 'ready'
    if (notify) this.callbacks.onPhaseChange('ready')
  }

  private async playCycle(generation: number): Promise<void> {
    if (!this.active || generation !== this.generation || !this.settings) return

    this.cancelScheduledWork()
    this.waitingUntil = 0
    this.audio.setLoop(false)
    this.audio.setMuted(false)
    this.audio.currentTime = this.settings.start
    this.setPhase('playing')

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
      this.waitingUntil = 0
      this.audio.setLoop(false)
      this.audio.setMuted(false)
      this.audio.pause()
      this.setPhase('error')
      this.callbacks.onError(error)
    }
  }

  handleTimeUpdate(currentTime: number): void {
    if (!this.active || !this.settings) return

    if (this.phase === 'playing' && currentTime >= this.settings.end - 0.015) {
      this.beginWait(this.generation)
      return
    }

    if (
      this.phase === 'waiting' &&
      this.waitingUntil > 0 &&
      this.scheduler.now() >= this.waitingUntil
    ) {
      void this.playCycle(this.generation)
    }
  }

  private watchPlayback(generation: number): void {
    this.frameId = this.scheduler.requestFrame(() => {
      if (!this.active || generation !== this.generation || !this.settings) return

      this.frameId = null
      this.handleTimeUpdate(this.audio.currentTime)
      if (this.phase === 'playing') {
        this.watchPlayback(generation)
      }
    })
  }

  private beginWait(generation: number): void {
    if (!this.settings || this.phase !== 'playing') return
    if (this.frameId !== null) {
      this.scheduler.cancelFrame(this.frameId)
      this.frameId = null
    }

    if (this.settings.delaySeconds === 0) {
      void this.playCycle(generation)
      return
    }

    // Keep a native media stream active while silent. iOS suspends page timers
    // and animation frames on lock, but lets background media continue.
    this.audio.setMuted(true)
    this.audio.setLoop(true)
    this.audio.currentTime = 0
    this.waitingUntil =
      this.scheduler.now() + this.settings.delaySeconds * 1000
    this.setPhase('waiting')
    void this.audio.play().catch((error) => this.fail(error, generation))

    this.timerId = this.scheduler.setTimer(() => {
      this.timerId = null
      if (
        this.active &&
        generation === this.generation &&
        this.phase === 'waiting'
      ) {
        void this.playCycle(generation)
      }
    }, this.settings.delaySeconds * 1000)
  }

  private fail(error: unknown, generation: number): void {
    if (generation !== this.generation) return
    this.active = false
    this.cancelScheduledWork()
    this.waitingUntil = 0
    this.audio.setLoop(false)
    this.audio.setMuted(false)
    this.audio.pause()
    this.setPhase('error')
    this.callbacks.onError(error)
  }

  private setPhase(phase: LoopPhase): void {
    this.phase = phase
    this.callbacks.onPhaseChange(phase)
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
