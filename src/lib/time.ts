export type Segment = {
  start: number
  end: number
}

export function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const roundedTenths = Math.round(safeSeconds * 10)
  const minutes = Math.floor(roundedTenths / 600)
  const remainder = (roundedTenths % 600) / 10
  return `${minutes}:${remainder.toFixed(1).padStart(4, '0')}`
}

export function createInitialSegment(duration: number): Segment {
  const safeDuration = Math.max(0, duration)
  return {
    start: 0,
    end: Math.min(10, safeDuration),
  }
}

export function clampZoom(
  pixelsPerSecond: number,
  containerWidth: number,
  duration: number,
): number {
  if (duration <= 0 || containerWidth <= 0) return 1
  const minZoom = containerWidth / duration
  const maxZoom = containerWidth / Math.min(5, duration)
  return Math.min(maxZoom, Math.max(minZoom, pixelsPerSecond))
}
