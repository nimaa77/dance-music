/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import {
  SHARE_ERROR_QUERY_PARAM,
  SHARE_TARGET_PATH,
  SHARED_AUDIO_FIELD,
  SHARED_AUDIO_QUERY_PARAM,
  isSupportedAudioFile,
  storeSharedAudio,
} from './lib/shared-audio'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ request, url }) =>
    request.method === 'POST' && url.pathname === SHARE_TARGET_PATH,
  async ({ request }) => {
    let entry: FormDataEntryValue | null

    try {
      const formData = await request.formData()
      entry = formData.get(SHARED_AUDIO_FIELD)
    } catch {
      return redirectToApp(SHARE_ERROR_QUERY_PARAM, 'missing')
    }

    if (!(entry instanceof File)) {
      return redirectToApp(SHARE_ERROR_QUERY_PARAM, 'missing')
    }
    if (!isSupportedAudioFile(entry)) {
      return redirectToApp(SHARE_ERROR_QUERY_PARAM, 'unsupported')
    }

    try {
      await storeSharedAudio(entry)
      return redirectToApp(SHARED_AUDIO_QUERY_PARAM, 'audio')
    } catch {
      return redirectToApp(SHARE_ERROR_QUERY_PARAM, 'storage')
    }
  },
  'POST',
)

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/health(?:\/|$)/, /^\/share-target(?:\/|$)/],
  }),
)

self.skipWaiting()
clientsClaim()

function redirectToApp(name: string, value: string): Response {
  const target = new URL('/', self.location.origin)
  target.searchParams.set(name, value)
  return Response.redirect(target.href, 303)
}
