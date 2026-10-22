// Processes the user must never kill — Windows would crash or lose the desktop.
const PROTECTED = new Set([
  'system', 'idle', 'registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'lsaiso',
  'svchost', 'dwm', 'explorer', 'fontdrvhost', 'memory compression', 'secure system', 'msmpeng',
  'nissrv', 'securityhealthservice', 'sihost', 'ctfmon', 'audiodg', 'spoolsv', 'wudfhost',
  'mpdefendercoreservice', 'taskhostw', 'runtimebroker', 'startmenuexperiencehost', 'shellexperiencehost',
  'searchhost', 'textinputhost', 'lockapp', 'conhost', 'powershell', 'electron', 'iceboost', 'dllhost',
  'wmiprvse', 'searchindexer', 'lsm', 'userinit', 'applicationframehost'
])

export function isProtected(name: string): boolean {
  return PROTECTED.has(name.toLowerCase())
}
