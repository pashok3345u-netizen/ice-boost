// Knowledge about common apps: what to do with them at startup and before a game.
import type { StartupItem } from '../../shared/types'

export type Hint = 'keep' | 'optional' | 'disable'

const STARTUP_RULES: [RegExp, Hint, string][] = [
  [/securityhealth|windows ?defender|msmpeng/i, 'keep', 'security'],
  [/rtkaud|realtek|nahimic|waves|dolby/i, 'keep', 'audio'],
  [/amdnoise|noisesuppression/i, 'optional', 'amdNoise'],
  [/radeon|amd|nvidia|nvcontainer|igfx|intel/i, 'keep', 'driver'],
  [/onedrive/i, 'optional', 'onedrive'],
  [/steam|epicgames|battle\.?net|ubisoft|uplay|origin|eadesktop|gog|roblox|riot|millida|launcher|xbox/i, 'disable', 'launcher'],
  [/discord|telegram|skype|teams|zoom|whatsapp|viber/i, 'disable', 'messenger'],
  [/opera|yandex|chrome|edge|firefox|brave|browser|vivaldi/i, 'disable', 'browser'],
  [/update|updater/i, 'optional', 'updater'],
  [/pantum|printer|\bhp\b|canon|epson|brother|xerox/i, 'optional', 'printer']
]

export function startupHint(item: StartupItem): { hint: Hint; why: string } {
  const hay = `${item.name} ${item.command} ${item.desc ?? ''} ${item.company ?? ''}`
  for (const [re, hint, why] of STARTUP_RULES) if (re.test(hay)) return { hint, why }
  return { hint: 'disable', why: 'extra' }
}

/** Nicer name for registry entries like "MicrosoftEdgeAutoLaunch_01FAF3…" */
export function startupTitle(item: StartupItem): string {
  const name = item.name.replace(/\.lnk$/i, '').replace(/_[0-9A-F]{16,}$/i, '')
  const generic = !item.desc || /^(update|launcher|setup|helper)$/i.test(item.desc)
  return generic ? name : item.desc!
}

export interface Closeable {
  proc: string
  label: string
  def: boolean
}

/** Apps that are safe to close before a game. Browsers/messengers are unchecked by default. */
export const CLOSEABLE: Closeable[] = [
  { proc: 'wallpaper64', label: 'Wallpaper Engine', def: true },
  { proc: 'wallpaper32', label: 'Wallpaper Engine', def: true },
  { proc: 'PhoneExperienceHost', label: 'Phone Link', def: true },
  { proc: 'browser_assistant', label: 'Opera GX Assistant', def: true },
  { proc: 'EpicGamesLauncher', label: 'Epic Games Launcher', def: true },
  { proc: 'Widgets', label: 'Windows Widgets', def: true },
  { proc: 'WidgetService', label: 'Windows Widgets', def: true },
  { proc: 'ms-teams', label: 'Microsoft Teams', def: true },
  { proc: 'Teams', label: 'Microsoft Teams', def: true },
  { proc: 'Copilot', label: 'Copilot', def: true },
  { proc: 'GoogleDriveFS', label: 'Google Drive', def: false },
  { proc: 'YandexDisk2', label: 'Yandex Disk', def: false },
  { proc: 'OneDrive', label: 'OneDrive', def: false },
  { proc: 'Spotify', label: 'Spotify', def: false },
  { proc: 'Telegram', label: 'Telegram', def: false },
  { proc: 'RadeonSoftware', label: 'AMD Adrenalin', def: false },
  { proc: 'msedge', label: 'Microsoft Edge', def: false },
  { proc: 'chrome', label: 'Google Chrome', def: false },
  { proc: 'opera', label: 'Opera / Opera GX', def: false },
  { proc: 'browser', label: 'Yandex Browser', def: false },
  { proc: 'firefox', label: 'Firefox', def: false }
]
