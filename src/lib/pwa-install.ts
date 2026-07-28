export type PwaInstallTarget = {
  install: () => void
  isAndroidFallback: boolean
  isAppleDesktopPlatform: boolean
  isAppleMobilePlatform: boolean
  isInstallAvailable: boolean
  isUnderStandaloneMode: boolean
  showDialog: (forced?: boolean) => void
}

export function shouldShowPwaInstall(target: PwaInstallTarget): boolean {
  return target.isInstallAvailable && !target.isUnderStandaloneMode
}

export function openPwaInstallPrompt(target: PwaInstallTarget): void {
  if (
    target.isAppleMobilePlatform ||
    target.isAppleDesktopPlatform ||
    target.isAndroidFallback
  ) {
    target.showDialog(true)
    target.install()
    return
  }
  target.install()
}
