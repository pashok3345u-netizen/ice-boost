// Places on disk IceBoost never deletes. The UI shows a lock on them, and the main process
// checks every path again right before moving it to the Recycle Bin.
import type { Places } from './types'

export function normPath(p: string): string {
  return p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

/** true if `child` is `parent` itself or somewhere inside it */
export function isInside(child: string, parent: string): boolean {
  const c = normPath(child)
  const p = normPath(parent)
  return c === p || c.startsWith(p + '\\')
}

export type LockReason = 'root' | 'system' | 'programs' | 'appdata' | 'special' | 'app'

// things in the root of a drive that belong to Windows
const SYSTEM_IN_ROOT =
  /^[a-z]:\\(\$recycle\.bin|system volume information|recovery|\$windows\.~bt|\$windows\.~ws|\$winreagent|\$sysreset|config\.msi|boot|efi|msocache|documents and settings|pagefile\.sys|hiberfil\.sys|swapfile\.sys|dumpstack\.log(\.tmp)?|bootmgr|bootnxt|bootsect\.bak)(\\|$)/

/**
 * Why a path can't be deleted from the disk map / file list, or null if it can.
 * `apps` = folders of installed programs: they are removed through their uninstaller instead.
 */
export function lockReason(path: string, places: Places, apps: string[]): LockReason | null {
  const n = normPath(path)
  if (/^[a-z]:$/.test(n)) return 'root'
  if (SYSTEM_IN_ROOT.test(n) || isInside(n, places.windows)) return 'system'
  if (places.programFiles.some((p) => isInside(n, p)) || isInside(n, places.programData)) return 'programs'
  if (places.appData.some((p) => isInside(n, p))) return 'appdata'
  if ([places.profile, ...places.known, ...places.oneDrive].some((p) => normPath(p) === n)) return 'special'
  // the Users folder and the like: they hold the user's whole folder
  if (isInside(places.profile, n)) return 'special'
  // inside a program's folder, or a folder that holds a program
  if (apps.some((a) => isInside(n, a) || isInside(a, n))) return 'app'
  return null
}

/** Leftovers of an uninstalled app may live in Program Files / AppData, but never in Windows or a drive root. */
export function leftoverAllowed(path: string, places: Places): boolean {
  const r = lockReason(path, places, [])
  return r === null || r === 'programs' || r === 'appdata'
}

export type FileKind = 'video' | 'archive' | 'installer' | 'disk' | 'audio' | 'image' | 'doc' | 'other'

const KINDS: [FileKind, RegExp][] = [
  ['video', /\.(mp4|mkv|avi|mov|wmv|webm|flv|m4v|ts|mts|m2ts|3gp|vob|mpg|mpeg)$/i],
  ['archive', /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|zst|cab)$/i],
  ['installer', /\.(exe|msi|msix|msixbundle|appx|appxbundle)$/i],
  ['disk', /\.(iso|img|vhd|vhdx|vmdk|bin|cue|nrg|mdf|dmg|wim|esd)$/i],
  ['audio', /\.(mp3|wav|flac|m4a|ogg|aac|wma|opus|aiff?)$/i],
  ['image', /\.(jpe?g|png|gif|bmp|tiff?|webp|heic|raw|cr2|nef|arw|dng|psd|kra|xcf)$/i],
  ['doc', /\.(pdf|docx?|xlsx?|pptx?|txt|odt|epub|djvu)$/i]
]

export function fileKind(path: string): FileKind {
  for (const [k, re] of KINDS) if (re.test(path)) return k
  return 'other'
}
