export const SHARE_TARGET_PATH = '/share-target'
export const SHARED_AUDIO_FIELD = 'audio'
export const SHARED_AUDIO_QUERY_PARAM = 'shared'
export const SHARE_ERROR_QUERY_PARAM = 'share-error'

const SHARED_AUDIO_CACHE = 'dance-loop-shared-audio'
const SHARED_AUDIO_CACHE_KEY = '/__dance-loop/shared-audio'
const SHARED_AUDIO_FILENAME_HEADER = 'X-Dance-Loop-Filename'
const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream'])
const AUDIO_EXTENSIONS = new Set([
  'aac',
  'flac',
  'm4a',
  'mp3',
  'oga',
  'ogg',
  'opus',
  'wav',
  'webm',
])

type AudioFileDescriptor = Pick<File, 'name' | 'type'>

export function isSupportedAudioFile(file: AudioFileDescriptor): boolean {
  const type = file.type.toLowerCase()
  if (type.startsWith('audio/') || type === 'application/ogg') return true
  if (!GENERIC_MIME_TYPES.has(type)) return false

  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension !== undefined && AUDIO_EXTENSIONS.has(extension)
}

export async function storeSharedAudio(file: File): Promise<void> {
  const cache = await caches.open(SHARED_AUDIO_CACHE)
  await cache.delete(SHARED_AUDIO_CACHE_KEY)
  await cache.put(
    SHARED_AUDIO_CACHE_KEY,
    new Response(file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        [SHARED_AUDIO_FILENAME_HEADER]: encodeURIComponent(
          file.name || 'shared-audio',
        ),
      },
    }),
  )
}

export async function consumeSharedAudio(): Promise<File | null> {
  if (!('caches' in globalThis)) return null

  const cache = await caches.open(SHARED_AUDIO_CACHE)
  const response = await cache.match(SHARED_AUDIO_CACHE_KEY)
  if (!response) return null

  try {
    const blob = await response.blob()
    const encodedName = response.headers.get(SHARED_AUDIO_FILENAME_HEADER)
    const name = decodeFilename(encodedName) || 'shared-audio'
    return new File([blob], name, {
      type: response.headers.get('Content-Type') || blob.type,
      lastModified: Date.now(),
    })
  } finally {
    await cache.delete(SHARED_AUDIO_CACHE_KEY)
  }
}

export function getShareErrorMessage(code: string | null): string {
  if (code === 'unsupported') {
    return 'The shared item is not a supported audio file.'
  }
  if (code === 'storage') {
    return 'The shared audio file could not be opened. Try choosing it from your device instead.'
  }
  return 'No audio file was included in the share.'
}

function decodeFilename(value: string | null): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}
