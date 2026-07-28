import { describe, expect, it } from 'vitest'
import { clampZoom, createInitialSegment, formatTime } from './time'

describe('time helpers', () => {
  it('formats time to tenths without producing invalid values', () => {
    expect(formatTime(80.04)).toBe('1:20.0')
    expect(formatTime(80.06)).toBe('1:20.1')
    expect(formatTime(-2)).toBe('0:00.0')
    expect(formatTime(Number.NaN)).toBe('0:00.0')
  })

  it('creates a ten-second initial segment when possible', () => {
    expect(createInitialSegment(180)).toEqual({ start: 0, end: 10 })
    expect(createInitialSegment(6.5)).toEqual({ start: 0, end: 6.5 })
  })

  it('clamps zoom between the full track and a five-second view', () => {
    expect(clampZoom(1, 300, 60)).toBe(5)
    expect(clampZoom(500, 300, 60)).toBe(60)
    expect(clampZoom(20, 300, 60)).toBe(20)
  })
})
