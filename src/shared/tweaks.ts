// Every Windows setting IceBoost can change. Each op knows its target value and the
// Windows default (`def`), which is used for "undo" when no backup was saved.

export type RegOp = {
  kind: 'reg'
  key: string
  name: string
  type: 'DWord' | 'String'
  value: number | string
  /** Windows default; null = value does not exist by default */
  def: number | string | null
}

export type ServiceOp = {
  kind: 'service'
  name: string
  startType: 'Disabled' | 'Manual'
  def: 'Automatic' | 'Manual'
}

export type PowerOp = { kind: 'power' }
export type HibernateOp = { kind: 'hibernate' }

export type TweakOp = RegOp | ServiceOp | PowerOp | HibernateOp

export type TweakGroup = 'game' | 'system' | 'visual' | 'privacy'

export interface Tweak {
  id: string
  group: TweakGroup
  /** safe = only your user settings; strong = system-wide, needs admin */
  level: 'safe' | 'strong'
  admin: boolean
  restart: 'none' | 'relogin' | 'reboot'
  recommended: boolean
  ops: TweakOp[]
}

const HKCU = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion'
const PROFILE = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'

const dw = (key: string, name: string, value: number, def: number | null): RegOp => ({
  kind: 'reg', key, name, type: 'DWord', value, def
})
const sz = (key: string, name: string, value: string, def: string | null): RegOp => ({
  kind: 'reg', key, name, type: 'String', value, def
})

export const TWEAKS: Tweak[] = [
  // ---- games
  {
    id: 'gameMode', group: 'game', level: 'safe', admin: false, restart: 'none', recommended: true,
    ops: [
      dw('HKCU:\\Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 1, null),
      dw('HKCU:\\Software\\Microsoft\\GameBar', 'AllowAutoGameMode', 1, null)
    ]
  },
  {
    id: 'gameDvr', group: 'game', level: 'safe', admin: false, restart: 'none', recommended: true,
    ops: [
      dw('HKCU:\\System\\GameConfigStore', 'GameDVR_Enabled', 0, 1),
      dw(`${HKCU}\\GameDVR`, 'AppCaptureEnabled', 0, null)
    ]
  },
  {
    id: 'powerPlan', group: 'game', level: 'safe', admin: false, restart: 'none', recommended: true,
    ops: [{ kind: 'power' }]
  },
  {
    id: 'mouseAccel', group: 'game', level: 'safe', admin: false, restart: 'relogin', recommended: true,
    ops: [
      sz('HKCU:\\Control Panel\\Mouse', 'MouseSpeed', '0', '1'),
      sz('HKCU:\\Control Panel\\Mouse', 'MouseThreshold1', '0', '6'),
      sz('HKCU:\\Control Panel\\Mouse', 'MouseThreshold2', '0', '10')
    ]
  },
  {
    id: 'gamePriority', group: 'game', level: 'strong', admin: true, restart: 'reboot', recommended: true,
    ops: [
      dw(`${PROFILE}\\Tasks\\Games`, 'Priority', 6, 2),
      sz(`${PROFILE}\\Tasks\\Games`, 'Scheduling Category', 'High', 'Medium'),
      sz(`${PROFILE}\\Tasks\\Games`, 'SFIO Priority', 'High', 'Normal'),
      dw(PROFILE, 'SystemResponsiveness', 10, 20)
    ]
  },
  {
    id: 'networkThrottling', group: 'game', level: 'strong', admin: true, restart: 'reboot', recommended: true,
    // -1 is written as 0xFFFFFFFF = "no throttling"
    ops: [dw(PROFILE, 'NetworkThrottlingIndex', -1, 10)]
  },

  // ---- system / boot
  {
    id: 'startupDelay', group: 'system', level: 'safe', admin: false, restart: 'none', recommended: true,
    ops: [dw(`${HKCU}\\Explorer\\Serialize`, 'StartupDelayInMSec', 0, null)]
  },
  {
    id: 'backgroundApps', group: 'system', level: 'safe', admin: false, restart: 'relogin', recommended: true,
    ops: [
      dw(`${HKCU}\\BackgroundAccessApplications`, 'GlobalUserDisabled', 1, null),
      dw(`${HKCU}\\Search`, 'BackgroundAppGlobalToggle', 0, null)
    ]
  },
  {
    id: 'webSearch', group: 'system', level: 'safe', admin: false, restart: 'relogin', recommended: true,
    ops: [dw(`${HKCU}\\Search`, 'BingSearchEnabled', 0, null)]
  },
  {
    id: 'widgets', group: 'system', level: 'strong', admin: true, restart: 'relogin', recommended: true,
    ops: [dw('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh', 'AllowNewsAndInterests', 0, null)]
  },
  {
    id: 'hibernate', group: 'system', level: 'strong', admin: true, restart: 'none', recommended: false,
    ops: [{ kind: 'hibernate' }]
  },

  // ---- visual
  {
    id: 'transparency', group: 'visual', level: 'safe', admin: false, restart: 'none', recommended: true,
    ops: [dw(`${HKCU}\\Themes\\Personalize`, 'EnableTransparency', 0, 1)]
  },
  {
    id: 'animations', group: 'visual', level: 'safe', admin: false, restart: 'relogin', recommended: true,
    ops: [
      sz('HKCU:\\Control Panel\\Desktop', 'MenuShowDelay', '100', '400'),
      sz('HKCU:\\Control Panel\\Desktop\\WindowMetrics', 'MinAnimate', '0', '1'),
      dw(`${HKCU}\\Explorer\\Advanced`, 'TaskbarAnimations', 0, null)
    ]
  },

  // ---- privacy / background junk
  {
    id: 'tipsAds', group: 'privacy', level: 'safe', admin: false, restart: 'none', recommended: true,
    ops: [
      'SubscribedContent-338388Enabled',
      'SubscribedContent-338389Enabled',
      'SubscribedContent-353694Enabled',
      'SubscribedContent-353696Enabled',
      'SystemPaneSuggestionsEnabled',
      'SilentInstalledAppsEnabled',
      'SoftLandingEnabled'
    ].map((name) => dw(`${HKCU}\\ContentDeliveryManager`, name, 0, 1))
  },
  {
    id: 'adId', group: 'privacy', level: 'safe', admin: false, restart: 'none', recommended: true,
    ops: [dw(`${HKCU}\\AdvertisingInfo`, 'Enabled', 0, 1)]
  },
  {
    id: 'telemetry', group: 'privacy', level: 'strong', admin: true, restart: 'reboot', recommended: true,
    ops: [
      dw('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection', 'AllowTelemetry', 0, null),
      { kind: 'service', name: 'DiagTrack', startType: 'Disabled', def: 'Automatic' }
    ]
  }
]

export const TWEAK_GROUPS: TweakGroup[] = ['game', 'system', 'visual', 'privacy']
