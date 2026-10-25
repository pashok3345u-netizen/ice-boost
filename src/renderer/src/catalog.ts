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

// ---- installed apps: what not to remove, and what is a game

export type AppHint = 'keep' | 'careful'

const APP_RULES: [RegExp, AppHint, string][] = [
  [/^iceboost$/i, 'keep', 'self'],
  [
    /visual c\+\+|visual basic\/c\+\+|redistributable|desktop runtime|\.net (runtime|framework)|directx|xna framework|vcredist|webview2|gameinput|application compatibility|tools for office runtime/i,
    'keep',
    'runtime'
  ],
  [/amd software|radeon|adrenalin|amd chipset|nvidia|geforce|realtek|intel\(r\)|chipset|driver/i, 'keep', 'driver'],
  [/^microsoft edge|^microsoft store$|app installer|установщик приложений|безопасность windows|windows security|xbox identity/i, 'keep', 'windows'],
  [/^steam$|epic games launcher|rockstar games launcher|ubisoft connect|^ea app$|battle\.net|gog galaxy/i, 'careful', 'launcher'],
  [/onedrive/i, 'careful', 'onedrive']
]

export function appHint(name: string): { hint: AppHint; why: string } | null {
  for (const [re, hint, why] of APP_RULES) if (re.test(name)) return { hint, why }
  return null
}

const NOT_GAMES = /blender|obs studio|wallpaper engine|soundpad|aseprite|rpg maker|sdk|launcher|social club|redistributable|dedicated server|editor/i
const GAME_PUBLISHERS =
  /rockstar|valve|ubisoft|electronic arts|frontier|bethesda|cd projekt|riot|blizzard|activision|2k games|bandai|capcom|square enix|sega|paradox|mojang|krafton|rare ltd|red barrels|wargaming|gaijin|hoyoverse|mihoyo|techland|devolver|team17|warner bros/i
const GAME_NAMES = /roblox|minecraft|grand theft|counter-strike|dota|fortnite|valorant|league of legends|pubg|apex legends|warzone|genshin|world of tanks|war thunder/i

export function isGame(a: { kind: string; name: string; publisher: string | null; location: string | null }): boolean {
  if (NOT_GAMES.test(a.name)) return false
  if (a.kind === 'steam' || a.kind === 'epic') return true
  if (a.location && /(games?|steamapps|xboxgames)\\/i.test(`${a.location}\\`)) return true
  return GAME_PUBLISHERS.test(a.publisher ?? '') || GAME_NAMES.test(a.name)
}

// ---- disk map: what well-known big things are

export function mapHint(path: string): string | null {
  const n = path.toLowerCase()
  if (/^[a-z]:\\hiberfil\.sys$/.test(n)) return 'hiberfil'
  if (/^[a-z]:\\(pagefile|swapfile)\.sys$/.test(n)) return 'pagefile'
  if (/^[a-z]:\\windows\.old$/.test(n)) return 'windowsOld'
  if (/^[a-z]:\\(amd|nvidia|intel)$/.test(n)) return 'drivers'
  if (/\\(steamapps|steamlibrary)$/.test(n)) return 'steam'
  if (/^[a-z]:\\\$recycle\.bin$/.test(n)) return 'recycle'
  if (/^[a-z]:\\system volume information$/.test(n)) return 'restore'
  if (/\\windows\\winsxs$/.test(n)) return 'winsxs'
  if (/\\appdata\\local\\temp$|^[a-z]:\\windows\\temp$/.test(n)) return 'temp'
  return null
}
