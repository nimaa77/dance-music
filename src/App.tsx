import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  FileAudio,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Upload,
  WifiOff,
  X,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { WaveformEditor, type WaveformHandle } from './components/WaveformEditor'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'
import { Slider } from './components/ui/slider'
import { LoopController, type LoopPhase } from './lib/loop-controller'
import { formatTime, type Segment } from './lib/time'

type WakeLockHandle = {
  release: () => Promise<void>
  released: boolean
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockHandle>
  }
}

const DEFAULT_SEGMENT: Segment = { start: 0, end: 0 }

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const waveformRef = useRef<WaveformHandle>(null)
  const loopRef = useRef<LoopController | null>(null)
  const wakeLockRef = useRef<WakeLockHandle | null>(null)
  const phaseRef = useRef<LoopPhase>('empty')

  const [file, setFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const [segment, setSegment] = useState<Segment>(DEFAULT_SEGMENT)
  const [delaySeconds, setDelaySeconds] = useState(5)
  const [phase, setPhase] = useState<LoopPhase>('empty')
  const [currentTime, setCurrentTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError: () => {
      setError('Offline setup could not be completed. The player still works online.')
    },
  })

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    const lock = wakeLockRef.current
    wakeLockRef.current = null
    if (lock && !lock.released) {
      await lock.release().catch(() => undefined)
    }
  }, [])

  const requestWakeLock = useCallback(async () => {
    const wakeLock = (navigator as WakeLockNavigator).wakeLock
    if (!wakeLock || document.visibilityState !== 'visible') return
    await releaseWakeLock()
    wakeLockRef.current = await wakeLock.request('screen').catch(() => null)
  }, [releaseWakeLock])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void releaseWakeLock()
      } else if (
        phaseRef.current === 'playing' ||
        phaseRef.current === 'waiting'
      ) {
        void requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [releaseWakeLock, requestWakeLock])

  const stopLoop = useCallback(
    (resetPhase = true) => {
      loopRef.current?.stop(resetPhase)
      void releaseWakeLock()
    },
    [releaseWakeLock],
  )

  useEffect(
    () => () => {
      loopRef.current?.stop(false)
      void releaseWakeLock()
    },
    [releaseWakeLock],
  )

  const handleFile = (nextFile?: File) => {
    if (!nextFile) return
    stopLoop(false)
    setError(null)
    setDuration(0)
    setSegment(DEFAULT_SEGMENT)
    setCurrentTime(0)
    setPhase('loading')
    setFile(nextFile)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleReady = (nextDuration: number, initialSegment: Segment) => {
    setDuration(nextDuration)
    setSegment(initialSegment)
    setCurrentTime(0)
    setPhase('ready')
    setError(null)

    const adapter = {
      get currentTime() {
        return waveformRef.current?.getCurrentTime() ?? 0
      },
      set currentTime(value: number) {
        waveformRef.current?.setTime(value)
      },
      play: () => waveformRef.current?.play() ?? Promise.reject(new Error('Player unavailable')),
      pause: () => waveformRef.current?.pause(),
    }

    loopRef.current = new LoopController(adapter, {
      onPhaseChange: setPhase,
      onError: () => {
        setError('Playback was interrupted. Tap Start loop to try again.')
        void releaseWakeLock()
      },
    })
  }

  const handleWaveformError = (message: string) => {
    stopLoop(false)
    setError(message)
    setPhase('error')
  }

  const startLoop = async () => {
    if (!loopRef.current || segment.end - segment.start < 1) return
    setError(null)
    void requestWakeLock()
    await loopRef.current.start({
      ...segment,
      delaySeconds,
    })
  }

  const isLooping = phase === 'playing' || phase === 'waiting'
  const isReady = phase === 'ready' || phase === 'error'

  const status = {
    empty: 'Choose a track to begin',
    loading: 'Drawing waveform…',
    ready: 'Ready to practice',
    playing: 'Playing selected loop',
    waiting: 'Waiting',
    error: 'Needs attention',
  }[phase]

  return (
    <main className="min-h-svh px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 sm:gap-5">
        <header className="flex items-center justify-between gap-4 px-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark" aria-hidden="true">
              <Repeat2 size={22} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[1.7rem] font-semibold tracking-[-0.045em] text-foreground">
                Dance Loop
              </h1>
              <p className="text-sm text-muted-foreground">Practice the part, not the pause.</p>
            </div>
          </div>
          {!isOnline ? (
            <Badge variant="secondary" className="shrink-0 gap-1.5">
              <WifiOff size={13} />
              Offline
            </Badge>
          ) : offlineReady ? (
            <Badge variant="outline" className="shrink-0 gap-1.5">
              <Check size={13} />
              Offline ready
            </Badge>
          ) : null}
        </header>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b border-border/80 p-4 sm:p-5">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                {file ? <Music2 size={22} /> : <FileAudio size={22} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {file?.name ?? 'No track selected'}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {duration > 0 ? formatTime(duration) : 'MP3, M4A, WAV, or another audio file'}
                </p>
              </div>
              <Button
                type="button"
                variant={file ? 'outline' : 'default'}
                size="sm"
                disabled={isLooping}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                {file ? 'Replace' : 'Choose'}
              </Button>
              <input
                ref={fileInputRef}
                data-testid="track-input"
                className="sr-only"
                type="file"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </div>

            <div className="p-4 sm:p-5">
              <WaveformEditor
                ref={waveformRef}
                file={file}
                disabled={isLooping}
                start={segment.start}
                end={segment.end}
                onReady={handleReady}
                onRegionChange={setSegment}
                onTimeChange={setCurrentTime}
                onError={handleWaveformError}
              />
            </div>
          </CardContent>
        </Card>

        {file && (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <TimeStat label="Start" value={formatTime(segment.start)} tone="start" />
              <TimeStat
                label="Loop"
                value={formatTime(Math.max(0, segment.end - segment.start))}
              />
              <TimeStat label="End" value={formatTime(segment.end)} tone="end" />
            </div>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="font-medium text-foreground">Pause between loops</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Silent reset time
                    </p>
                  </div>
                  <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                    {delaySeconds}s
                  </span>
                </div>
                <Slider
                  aria-label="Pause between loops"
                  min={0}
                  max={30}
                  step={1}
                  value={[delaySeconds]}
                  disabled={isLooping}
                  onValueChange={([value]) => setDelaySeconds(value)}
                />
                <div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground">
                  <span>No pause</span>
                  <span>30 sec</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive"
          >
            <X className="mt-0.5 shrink-0" size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="sticky bottom-0 z-20 -mx-1 mt-auto rounded-[1.4rem] bg-background/85 p-1 backdrop-blur-xl">
          <Button
            className="h-14 w-full rounded-2xl text-base shadow-lg shadow-primary/15"
            size="lg"
            disabled={!file || phase === 'loading' || (!isReady && !isLooping)}
            onClick={isLooping ? () => stopLoop() : startLoop}
          >
            {phase === 'waiting' ? (
              <Pause size={20} fill="currentColor" />
            ) : isLooping ? (
              <RotateCcw size={20} />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
            {isLooping ? 'Stop loop' : 'Start loop'}
          </Button>
          <p
            className="mt-2 text-center text-xs font-medium text-muted-foreground"
            aria-live="polite"
          >
            {status}
            {phase === 'playing' && ` · ${formatTime(currentTime)}`}
          </p>
        </div>

        {!file && (
          <div className="empty-guide">
            <div className="guide-line" />
            <p>Choose a song, drag the handles around the part you want, then loop it.</p>
          </div>
        )}

        {needRefresh && (
          <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-2xl">
            <RefreshCw className="shrink-0 text-primary" size={18} />
            <p className="flex-1 text-sm text-foreground">A fresh version is ready.</p>
            <Button size="sm" onClick={() => updateServiceWorker(true)}>
              Update
            </Button>
            <Button
              aria-label="Dismiss update"
              size="icon"
              variant="ghost"
              onClick={() => setNeedRefresh(false)}
            >
              <X size={17} />
            </Button>
          </div>
        )}

        {offlineReady && (
          <button
            type="button"
            className="sr-only"
            onClick={() => setOfflineReady(false)}
          >
            Dismiss offline ready message
          </button>
        )}
      </div>
    </main>
  )
}

function TimeStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'start' | 'end'
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card px-3 py-3 text-center shadow-sm">
      <p
        className={
          tone === 'start'
            ? 'text-xs font-semibold uppercase tracking-wider text-start-marker'
            : tone === 'end'
              ? 'text-xs font-semibold uppercase tracking-wider text-end-marker'
              : 'text-xs font-semibold uppercase tracking-wider text-muted-foreground'
        }
      >
        {label}
      </p>
      <p className="mt-1 font-mono text-[0.95rem] font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

export default App
