import { describe, expect, it, vi } from 'vitest'
import {
  openPwaInstallPrompt,
  shouldShowPwaInstall,
  type PwaInstallTarget,
} from './pwa-install'

function createTarget(
  overrides: Partial<PwaInstallTarget> = {},
): PwaInstallTarget {
  return {
    install: vi.fn(),
    isAndroidFallback: false,
    isAppleDesktopPlatform: false,
    isAppleMobilePlatform: false,
    isInstallAvailable: true,
    isUnderStandaloneMode: false,
    showDialog: vi.fn(),
    ...overrides,
  }
}

describe('PWA installation', () => {
  it('shows the install action only when installation is available', () => {
    expect(shouldShowPwaInstall(createTarget())).toBe(true)
    expect(
      shouldShowPwaInstall(createTarget({ isInstallAvailable: false })),
    ).toBe(false)
    expect(
      shouldShowPwaInstall(createTarget({ isUnderStandaloneMode: true })),
    ).toBe(false)
  })

  it('uses the native prompt on supporting Chromium browsers', () => {
    const target = createTarget()
    openPwaInstallPrompt(target)
    expect(target.install).toHaveBeenCalledOnce()
    expect(target.showDialog).not.toHaveBeenCalled()
  })

  it('opens manual guidance on Apple and fallback Android browsers', () => {
    const target = createTarget({ isAppleMobilePlatform: true })
    openPwaInstallPrompt(target)
    expect(target.showDialog).toHaveBeenCalledWith(true)
    expect(target.install).toHaveBeenCalledOnce()
  })
})
