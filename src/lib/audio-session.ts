type AudioSession = {
  type: string
}

type NavigatorWithAudioSession = Navigator & {
  audioSession?: AudioSession
}

export function enablePlaybackAudioSession(
  navigatorObject: Navigator = navigator,
): void {
  try {
    const audioSession = (navigatorObject as NavigatorWithAudioSession)
      .audioSession
    if (audioSession) audioSession.type = 'playback'
  } catch {
    // AudioSession is still experimental in WebKit. Playback must continue
    // normally if a particular iOS release exposes but rejects the setter.
  }
}
