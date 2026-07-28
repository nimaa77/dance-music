import { describe, expect, it } from 'vitest'
import { createWaveformEnvelope } from './waveform'

describe('createWaveformEnvelope', () => {
  it('preserves useful differences between quiet and loud sections', () => {
    const envelope = createWaveformEnvelope(
      [new Float32Array([0.05, -0.05, 0.4, -0.4])],
      2,
    )

    expect(envelope[1]).toBeGreaterThan(envelope[0] * 5)
  })

  it('clamps very loud audio and handles empty data', () => {
    expect(createWaveformEnvelope([[1, -1]], 1)).toEqual([1])
    expect(createWaveformEnvelope([], 10)).toEqual([])
    expect(createWaveformEnvelope([[0.5]], 0)).toEqual([])
  })
})
