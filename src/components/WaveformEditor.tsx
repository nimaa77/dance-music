import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { AudioLines, Hand, ScanLine } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, {
  type Region,
} from 'wavesurfer.js/dist/plugins/regions.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import { clampZoom, createInitialSegment, type Segment } from '../lib/time'
import { createWaveformEnvelope } from '../lib/waveform'

export type WaveformHandle = {
  play: () => Promise<void>
  pause: () => void
  setTime: (time: number) => void
  getCurrentTime: () => number
  startKeepAlive: () => Promise<void>
  stopKeepAlive: () => void
}

type WaveformEditorProps = {
  file: File | null
  disabled: boolean
  start: number
  end: number
  onReady: (duration: number, initialSegment: Segment) => void
  onRegionChange: (segment: Segment) => void
  onTimeChange: (time: number) => void
  onWaitClockTick: () => void
  onError: (message: string) => void
}

type PinchState = {
  distance: number
  zoom: number
  midpointTime: number
}

type TouchPanState = {
  clientX: number
  clientY: number
  scrollLeft: number
}

type NativeGestureState = {
  initialScale: number
  midpoint: number
  midpointTime: number
  zoom: number
}

type NativeGestureEvent = Event & {
  clientX?: number
  scale?: number
}

function renderEnergyWaveform(
  channels: Array<Float32Array | number[]>,
  context: CanvasRenderingContext2D,
): void {
  const { width, height } = context.canvas
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1)
  const barWidth = 2 * pixelRatio
  const barGap = 1.5 * pixelRatio
  const spacing = barWidth + barGap
  const barCount = Math.max(1, Math.floor(width / spacing))
  const envelope = createWaveformEnvelope(channels, barCount)

  envelope.forEach((amplitude, index) => {
    const barHeight = Math.max(
      2 * pixelRatio,
      amplitude * height * 0.88,
    )
    context.fillRect(
      index * spacing,
      (height - barHeight) / 2,
      barWidth,
      barHeight,
    )
  })
}

function decorateRegionHandle(
  handle: HTMLElement | null | undefined,
  side: 'start' | 'end',
): void {
  if (!handle) return

  const isStart = side === 'start'
  handle.setAttribute(
    'aria-label',
    isStart ? 'Adjust loop start' : 'Adjust loop end',
  )
  handle.setAttribute(
    'title',
    isStart ? 'Drag to adjust loop start' : 'Drag to adjust loop end',
  )

  const label = document.createElement('span')
  label.setAttribute(
    'part',
    `region-handle-label region-handle-label-${side}`,
  )
  label.setAttribute('aria-hidden', 'true')
  label.textContent = isStart ? 'START' : 'END'

  const grip = document.createElement('span')
  grip.setAttribute(
    'part',
    `region-handle-grip region-handle-grip-${side}`,
  )
  grip.setAttribute('aria-hidden', 'true')
  grip.textContent = isStart ? '◀' : '▶'

  handle.append(label, grip)
}

export const WaveformEditor = forwardRef<WaveformHandle, WaveformEditorProps>(
  function WaveformEditor(
    {
      file,
      disabled,
      start,
      end,
      onReady,
      onRegionChange,
      onTimeChange,
      onWaitClockTick,
      onError,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const gestureRef = useRef<HTMLDivElement>(null)
    const keepAliveRef = useRef<HTMLAudioElement>(null)
    const waveSurferRef = useRef<WaveSurfer | null>(null)
    const regionRef = useRef<Region | null>(null)
    const pinchRef = useRef<PinchState | null>(null)
    const touchPanRef = useRef<TouchPanState | null>(null)
    const nativeGestureRef = useRef<NativeGestureState | null>(null)
    const zoomRef = useRef(1)
    const durationRef = useRef(0)
    const disabledRef = useRef(disabled)
    const callbacksRef = useRef({
      onReady,
      onRegionChange,
      onTimeChange,
      onWaitClockTick,
      onError,
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      disabledRef.current = disabled
      const region = regionRef.current
      region?.setOptions({
        drag: !disabled,
        resize: !disabled,
        resizeStart: !disabled,
        resizeEnd: !disabled,
      })
      waveSurferRef.current?.toggleInteraction(!disabled)
    }, [disabled])

    useEffect(() => {
      callbacksRef.current = {
        onReady,
        onRegionChange,
        onTimeChange,
        onWaitClockTick,
        onError,
      }
    }, [
      onError,
      onReady,
      onRegionChange,
      onTimeChange,
      onWaitClockTick,
    ])

    useEffect(() => {
      const region = regionRef.current
      if (!region || disabled) return
      if (
        Math.abs(region.start - start) > 0.01 ||
        Math.abs(region.end - end) > 0.01
      ) {
        region.setOptions({ start, end })
      }
    }, [disabled, end, start])

    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          const waveSurfer = waveSurferRef.current
          if (!waveSurfer) throw new Error('Player unavailable')
          await waveSurfer.play()
        },
        pause: () => waveSurferRef.current?.pause(),
        setTime: (time) => waveSurferRef.current?.setTime(time),
        getCurrentTime: () => waveSurferRef.current?.getCurrentTime() ?? 0,
        startKeepAlive: async () => {
          const waveSurfer = waveSurferRef.current
          const keepAlive = keepAliveRef.current
          if (!waveSurfer || !keepAlive) return
          if (!keepAlive.src) {
            const media = waveSurfer.getMediaElement()
            if (!media) return
            keepAlive.src = media.currentSrc || media.src
          }
          keepAlive.currentTime = 0
          await keepAlive.play()
        },
        stopKeepAlive: () => {
          const keepAlive = keepAliveRef.current
          if (!keepAlive) return
          keepAlive.pause()
          keepAlive.currentTime = 0
        },
      }),
      [],
    )

    useEffect(() => {
      if (!file || !containerRef.current) return

      setLoading(true)
      let disposed = false
      const keepAlive = keepAliveRef.current
      const regions = RegionsPlugin.create()
      const timeline = TimelinePlugin.create({
        height: 22,
        timeInterval: 5,
        primaryLabelInterval: 10,
        style: {
          color: '#77746a',
          fontSize: '10px',
        },
      })
      const waveSurfer = WaveSurfer.create({
        container: containerRef.current,
        height: 126,
        waveColor: '#a5a398',
        progressColor: '#34362f',
        cursorColor: '#20211d',
        cursorWidth: 2,
        renderFunction: renderEnergyWaveform,
        hideScrollbar: true,
        autoScroll: true,
        autoCenter: false,
        dragToSeek: { debounceTime: 0 },
        plugins: [regions, timeline],
      })

      waveSurferRef.current = waveSurfer
      const unsubscribers = [
        waveSurfer.on('ready', (duration) => {
          durationRef.current = duration
          const width = waveSurfer.getWidth() || containerRef.current?.clientWidth || 1
          const initialZoom = clampZoom(width / Math.min(30, duration), width, duration)
          zoomRef.current = initialZoom
          waveSurfer.zoom(initialZoom)

          const initialSegment = createInitialSegment(duration)
          const region = regions.addRegion({
            id: 'practice-loop',
            ...initialSegment,
            drag: true,
            resize: true,
            minLength: Math.min(1, duration),
            color: 'rgba(217, 255, 104, 0.24)',
          })
          const startHandle = region.element?.querySelector<HTMLElement>(
            '[part~="region-handle-left"]',
          )
          const endHandle = region.element?.querySelector<HTMLElement>(
            '[part~="region-handle-right"]',
          )
          decorateRegionHandle(startHandle, 'start')
          decorateRegionHandle(endHandle, 'end')
          regionRef.current = region
          if (keepAlive) {
            const media = waveSurfer.getMediaElement()
            if (media) {
              keepAlive.src = media.currentSrc || media.src
              keepAlive.load()
            }
          }
          setLoading(false)
          callbacksRef.current.onReady(duration, initialSegment)
        }),
        waveSurfer.on('timeupdate', (time) => {
          callbacksRef.current.onTimeChange(time)
        }),
        waveSurfer.on('error', () => {
          setLoading(false)
          callbacksRef.current.onError(
            'This audio file could not be opened. Try an MP3, M4A, or WAV file.',
          )
        }),
        waveSurfer.on('zoom', (zoom) => {
          zoomRef.current = zoom
        }),
        regions.on('region-update', (region) => {
          callbacksRef.current.onRegionChange({
            start: region.start,
            end: region.end,
          })
        }),
        regions.on('region-updated', (region) => {
          callbacksRef.current.onRegionChange({
            start: region.start,
            end: region.end,
          })
        }),
      ]

      void waveSurfer.loadBlob(file).catch((error: unknown) => {
        if (
          disposed ||
          (typeof error === 'object' && error !== null &&
            'name' in error && error.name === 'AbortError')
        ) return
        setLoading(false)
        callbacksRef.current.onError(
          'This audio file could not be opened. Try an MP3, M4A, or WAV file.',
        )
      })

      return () => {
        disposed = true
        unsubscribers.forEach((unsubscribe) => unsubscribe())
        if (keepAlive) {
          keepAlive.pause()
          keepAlive.removeAttribute('src')
          keepAlive.load()
        }
        regionRef.current = null
        waveSurferRef.current = null
        waveSurfer.destroy()
      }
    }, [file])

    useEffect(() => {
      const target = gestureRef.current
      if (!target) return
      let pointerInside = false

      const isInsideWaveform = (event: Event) => {
        if (event.composedPath().includes(target)) return true
        if (!('clientX' in event) || !('clientY' in event)) return false
        const rect = target.getBoundingClientRect()
        const clientX = Number(event.clientX)
        const clientY = Number(event.clientY)
        return (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        )
      }

      const startedOnRegion = (event: TouchEvent) =>
        event.composedPath().some((node) => {
          if (!(node instanceof HTMLElement)) return false
          const part = node.getAttribute('part')
          return part?.includes('region') ?? false
        })

      const distanceBetween = (touches: TouchList) =>
        Math.hypot(
          touches[0].clientX - touches[1].clientX,
          touches[0].clientY - touches[1].clientY,
        )

      const midpointX = (touches: TouchList) => {
        const rect = target.getBoundingClientRect()
        return (touches[0].clientX + touches[1].clientX) / 2 - rect.left
      }

      const zoomAroundPoint = (
        nextZoom: number,
        midpoint: number,
        midpointTime: number,
      ) => {
        const waveSurfer = waveSurferRef.current
        if (!waveSurfer) return
        waveSurfer.zoom(nextZoom)
        waveSurfer.setScroll(
          Math.max(0, midpointTime * nextZoom - midpoint),
        )
      }

      const startTouchGesture = (event: TouchEvent) => {
        const waveSurfer = waveSurferRef.current
        if (
          event.touches.length === 1 &&
          waveSurfer &&
          !disabledRef.current &&
          !startedOnRegion(event)
        ) {
          touchPanRef.current = {
            clientX: event.touches[0].clientX,
            clientY: event.touches[0].clientY,
            scrollLeft: waveSurfer.getScroll(),
          }
          return
        }

        touchPanRef.current = null
        if (
          event.touches.length !== 2 ||
          !waveSurfer ||
          disabledRef.current ||
          durationRef.current <= 0
        ) {
          return
        }
        event.preventDefault()
        const midpoint = midpointX(event.touches)
        const zoom = zoomRef.current
        pinchRef.current = {
          distance: distanceBetween(event.touches),
          zoom,
          midpointTime: (waveSurfer.getScroll() + midpoint) / zoom,
        }
      }

      const moveTouchGesture = (event: TouchEvent) => {
        const waveSurfer = waveSurferRef.current

        if (
          event.touches.length === 1 &&
          waveSurfer &&
          touchPanRef.current &&
          !disabledRef.current
        ) {
          const pan = touchPanRef.current
          const deltaX = event.touches[0].clientX - pan.clientX
          const deltaY = event.touches[0].clientY - pan.clientY
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            event.preventDefault()
            waveSurfer.setScroll(Math.max(0, pan.scrollLeft - deltaX))
          }
          return
        }

        const pinch = pinchRef.current
        if (
          event.touches.length !== 2 ||
          !waveSurfer ||
          !pinch ||
          disabledRef.current
        ) {
          return
        }
        event.preventDefault()
        const width = waveSurfer.getWidth() || target.clientWidth || 1
        const nextZoom = clampZoom(
          pinch.zoom * (distanceBetween(event.touches) / pinch.distance),
          width,
          durationRef.current,
        )
        waveSurfer.zoom(nextZoom)
        const currentMidpoint = midpointX(event.touches)
        zoomAroundPoint(nextZoom, currentMidpoint, pinch.midpointTime)
      }

      const endTouchGesture = (event: TouchEvent) => {
        if (event.touches.length < 2) pinchRef.current = null
        if (event.touches.length === 0) touchPanRef.current = null
      }

      const handleTrackpadZoom = (event: WheelEvent) => {
        const waveSurfer = waveSurferRef.current
        if (
          !event.ctrlKey ||
          (!pointerInside && !isInsideWaveform(event)) ||
          !waveSurfer ||
          disabledRef.current ||
          durationRef.current <= 0
        ) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        const rect = target.getBoundingClientRect()
        const midpoint = Math.max(
          0,
          Math.min(rect.width, event.clientX - rect.left),
        )
        const currentZoom = zoomRef.current
        const midpointTime =
          (waveSurfer.getScroll() + midpoint) / currentZoom
        const modeScale =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? target.clientHeight
              : 1
        const delta = Math.max(
          -50,
          Math.min(50, event.deltaY * modeScale),
        )
        const width = waveSurfer.getWidth() || target.clientWidth || 1
        const nextZoom = clampZoom(
          currentZoom * Math.exp(-delta * 0.012),
          width,
          durationRef.current,
        )
        zoomAroundPoint(nextZoom, midpoint, midpointTime)
      }

      const startNativeGesture = (rawEvent: Event) => {
        const event = rawEvent as NativeGestureEvent
        const waveSurfer = waveSurferRef.current
        if (
          !isInsideWaveform(event) ||
          !waveSurfer ||
          disabledRef.current ||
          durationRef.current <= 0
        ) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        const rect = target.getBoundingClientRect()
        const midpoint =
          typeof event.clientX === 'number'
            ? Math.max(0, Math.min(rect.width, event.clientX - rect.left))
            : rect.width / 2
        const zoom = zoomRef.current
        nativeGestureRef.current = {
          initialScale: event.scale || 1,
          midpoint,
          midpointTime: (waveSurfer.getScroll() + midpoint) / zoom,
          zoom,
        }
        pinchRef.current = null
      }

      const changeNativeGesture = (rawEvent: Event) => {
        const event = rawEvent as NativeGestureEvent
        const gesture = nativeGestureRef.current
        const waveSurfer = waveSurferRef.current
        if (!gesture || !waveSurfer) return

        event.preventDefault()
        event.stopPropagation()
        const width = waveSurfer.getWidth() || target.clientWidth || 1
        const scale = (event.scale || 1) / gesture.initialScale
        const nextZoom = clampZoom(
          gesture.zoom * scale,
          width,
          durationRef.current,
        )
        zoomAroundPoint(
          nextZoom,
          gesture.midpoint,
          gesture.midpointTime,
        )
      }

      const endNativeGesture = (event: Event) => {
        if (!nativeGestureRef.current) return
        event.preventDefault()
        event.stopPropagation()
        nativeGestureRef.current = null
      }

      const markPointerInside = () => {
        pointerInside = true
      }

      const markPointerOutside = () => {
        pointerInside = false
      }

      document.addEventListener('wheel', handleTrackpadZoom, {
        passive: false,
        capture: true,
      })
      target.addEventListener('pointerenter', markPointerInside)
      target.addEventListener('pointerleave', markPointerOutside)
      target.addEventListener('touchstart', startTouchGesture, {
        passive: false,
      })
      target.addEventListener('touchmove', moveTouchGesture, {
        passive: false,
      })
      target.addEventListener('touchend', endTouchGesture, {
        passive: true,
      })
      target.addEventListener('touchcancel', endTouchGesture, {
        passive: true,
      })
      document.addEventListener('gesturestart', startNativeGesture, true)
      document.addEventListener('gesturechange', changeNativeGesture, true)
      document.addEventListener('gestureend', endNativeGesture, true)

      return () => {
        document.removeEventListener('wheel', handleTrackpadZoom, true)
        target.removeEventListener('pointerenter', markPointerInside)
        target.removeEventListener('pointerleave', markPointerOutside)
        target.removeEventListener('touchstart', startTouchGesture)
        target.removeEventListener('touchmove', moveTouchGesture)
        target.removeEventListener('touchend', endTouchGesture)
        target.removeEventListener('touchcancel', endTouchGesture)
        document.removeEventListener('gesturestart', startNativeGesture, true)
        document.removeEventListener(
          'gesturechange',
          changeNativeGesture,
          true,
        )
        document.removeEventListener('gestureend', endNativeGesture, true)
      }
    }, [file])

    if (!file) {
      return (
        <div className="waveform-frame">
          <div className="waveform-empty">
            <span className="waveform-empty-icon">
              <AudioLines size={22} />
            </span>
            <div>
              <p className="font-medium text-foreground">Your waveform will appear here</p>
              <p className="mt-1 text-xs">Audio stays on this device.</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        <div
          ref={gestureRef}
          className={`waveform-frame ${disabled ? 'is-disabled' : ''}`}
        >
          {loading && (
            <div className="waveform-loading" aria-live="polite">
              <span className="text-sm font-semibold">Reading track…</span>
              <span className="waveform-loading-bar" />
            </div>
          )}
          <div ref={containerRef} className="waveform-interaction" />
          <audio
            ref={keepAliveRef}
            aria-hidden="true"
            muted
            loop
            playsInline
            preload="auto"
            onTimeUpdate={() => callbacksRef.current.onWaitClockTick()}
          />
        </div>
        <div className="waveform-help">
          <span>
            <Hand size={13} />
            Drag to move · tap to seek
          </span>
          <span>
            <ScanLine size={13} />
            Pinch / trackpad zoom
          </span>
        </div>
      </>
    )
  },
)
