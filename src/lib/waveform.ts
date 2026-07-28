type AudioChannel = Float32Array | number[]

export function createWaveformEnvelope(
  channels: AudioChannel[],
  barCount: number,
  gain = 3,
): number[] {
  const sampleCount = Math.max(0, ...channels.map((channel) => channel.length))
  const count = Math.max(0, Math.floor(barCount))
  if (sampleCount === 0 || count === 0) return []

  return Array.from({ length: count }, (_, barIndex) => {
    const start = Math.floor((barIndex * sampleCount) / count)
    const end = Math.max(
      start + 1,
      Math.floor(((barIndex + 1) * sampleCount) / count),
    )
    let sumOfSquares = 0
    let samplesRead = 0

    for (const channel of channels) {
      const channelEnd = Math.min(end, channel.length)
      for (let index = start; index < channelEnd; index += 1) {
        const sample = channel[index] ?? 0
        sumOfSquares += sample * sample
        samplesRead += 1
      }
    }

    const rms = samplesRead > 0 ? Math.sqrt(sumOfSquares / samplesRead) : 0
    return Math.min(1, Math.pow(rms * gain, 1.15))
  })
}
