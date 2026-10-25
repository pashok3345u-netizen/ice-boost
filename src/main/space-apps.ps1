# Installed programs: the same list as Windows "Apps", plus Steam/Epic games and Microsoft Store apps.
# Only reads. Prints one JSON object.

$reg = @()
$roots = @(
  @{ hive = 'HKLM'; path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall' },
  @{ hive = 'HKLM32'; path = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' },
  @{ hive = 'HKCU'; path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' }
)
foreach ($r in $roots) {
  foreach ($k in @(Get-ChildItem -LiteralPath $r.path -ErrorAction SilentlyContinue)) {
    $name = "$($k.GetValue('DisplayName'))".Trim()
    if (-not $name) { continue }
    # parts of other programs and Windows updates are hidden in Windows "Apps" too
    if ($k.GetValue('SystemComponent') -eq 1 -or $k.GetValue('ParentKeyName')) { continue }
    if ("$($k.GetValue('ReleaseType'))" -match 'Update|Hotfix|Service Pack') { continue }
    $un = "$($k.GetValue('UninstallString'))".Trim()
    if (-not $un) { continue }
    $size = $k.GetValue('EstimatedSize')
    $reg += @{
      key = $k.Name
      keyName = $k.PSChildName
      hive = $r.hive
      name = $name
      publisher = "$($k.GetValue('Publisher'))".Trim()
      version = "$($k.GetValue('DisplayVersion'))".Trim()
      location = "$($k.GetValue('InstallLocation'))".Trim().Trim('"')
      icon = "$($k.GetValue('DisplayIcon'))".Trim()
      uninstall = $un
      quiet = "$($k.GetValue('QuietUninstallString'))".Trim()
      msi = [int]($k.GetValue('WindowsInstaller') -eq 1)
      noRemove = [int]($k.GetValue('NoRemove') -eq 1)
      size = $(if ($size -is [int]) { [int64]$size * 1024 } else { 0 })
      date = "$($k.GetValue('InstallDate'))".Trim()
    }
  }
}

# ---- Steam: libraries and game manifests (size and "last played" are written by Steam itself)
$steamPath = $null
foreach ($kp in 'HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam') {
  $v = Get-ItemProperty -LiteralPath $kp -ErrorAction SilentlyContinue
  if ($v.SteamPath) { $steamPath = $v.SteamPath } elseif ($v.InstallPath) { $steamPath = $v.InstallPath }
  if ($steamPath) { break }
}
function Get-AcfField($text, $field) {
  if ($text -match ('"' + $field + '"\s+"([^"]*)"')) { return $Matches[1] }
  return ''
}
$steam = @()
if ($steamPath) {
  $steamPath = ($steamPath -replace '/', '\').TrimEnd('\')
  $libs = @{}
  $vdf = "$steamPath\steamapps\libraryfolders.vdf"
  if (Test-Path -LiteralPath $vdf) {
    foreach ($m in [regex]::Matches((Get-Content -LiteralPath $vdf -Raw), '"path"\s+"([^"]+)"')) {
      $p = ($m.Groups[1].Value -replace '\\\\', '\').TrimEnd('\')
      $libs[$p.ToLower()] = $p
    }
  }
  if (-not $libs.ContainsKey($steamPath.ToLower())) { $libs[$steamPath.ToLower()] = $steamPath }
  foreach ($lib in @($libs.Values)) {
    # a library on a disk that isn't connected right now
    if (-not (Test-Path -LiteralPath "$lib\steamapps")) { continue }
    foreach ($f in @(Get-ChildItem -LiteralPath "$lib\steamapps" -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue)) {
      $t = Get-Content -LiteralPath $f.FullName -Raw
      $dir = Get-AcfField $t 'installdir'
      # "Steamworks Common Redistributables" — shared parts for all games, not a game
      if ((Get-AcfField $t 'appid') -eq '228980') { continue }
      $steam += @{
        appid = Get-AcfField $t 'appid'
        name = Get-AcfField $t 'name'
        dir = $(if ($dir) { "$lib\steamapps\common\$dir" } else { '' })
        size = [int64]("0" + (Get-AcfField $t 'SizeOnDisk'))
        last = [int64]("0" + (Get-AcfField $t 'LastPlayed'))
        manifest = $f.FullName
      }
    }
  }
}

# ---- Epic Games: one .item (JSON) file per installed game
$epic = @()
foreach ($f in @(Get-ChildItem -LiteralPath "$env:ProgramData\Epic\EpicGamesLauncher\Data\Manifests" -Filter *.item -ErrorAction SilentlyContinue)) {
  try {
    $j = Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
    if ($j.bIsIncompleteInstall) { continue }
    $epic += @{
      app = "$($j.AppName)"
      name = "$($j.DisplayName)"
      dir = "$($j.InstallLocation)"
      size = [int64]$j.InstallSize
      exe = "$($j.LaunchExecutable)"
      manifest = $f.FullName
    }
  } catch {}
}

# ---- Microsoft Store apps that have a Start menu entry (codecs and extensions don't)
$start = @{}
try {
  foreach ($s in @(Get-StartApps)) {
    $i = $s.AppID.IndexOf('!')
    if ($i -gt 0) { $fam = $s.AppID.Substring(0, $i); if (-not $start.ContainsKey($fam)) { $start[$fam] = $s.Name } }
  }
} catch {}
$store = @()
foreach ($p in @(Get-AppxPackage -ErrorAction SilentlyContinue)) {
  if ($p.IsFramework -or $p.NonRemovable -or $p.IsResourcePackage -or $p.IsBundle -or "$($p.SignatureKind)" -ne 'Store') { continue }
  $name = $start[$p.PackageFamilyName]
  if (-not $name -or -not $p.InstallLocation) { continue }
  $logo = ''
  $publisher = ''
  try {
    [xml]$m = Get-Content -LiteralPath (Join-Path $p.InstallLocation 'AppxManifest.xml') -Raw
    $publisher = "$($m.Package.Properties.PublisherDisplayName)"
    $ve = @($m.Package.Applications.Application)[0].VisualElements
    $rel = "$($ve.Square44x44Logo)"
    if (-not $rel) { $rel = "$($m.Package.Properties.Logo)" }
    if ($rel) {
      $full = Join-Path $p.InstallLocation $rel
      $dir = Split-Path $full
      $base = [IO.Path]::GetFileNameWithoutExtension($full)
      $ext = [IO.Path]::GetExtension($full)
      $c = @(Get-ChildItem -LiteralPath $dir -Filter "$base*$ext" -ErrorAction SilentlyContinue)
      $pick = $null
      foreach ($pat in 'targetsize-32_altform-unplated', 'targetsize-32', 'targetsize-48', 'scale-100', 'scale-200') {
        $pick = $c | Where-Object { $_.Name -match [regex]::Escape($pat) } | Select-Object -First 1
        if ($pick) { break }
      }
      if (-not $pick) { $pick = $c | Sort-Object { $_.Name.Length } | Select-Object -First 1 }
      if ($pick) { $logo = $pick.FullName } elseif (Test-Path -LiteralPath $full) { $logo = $full }
    }
  } catch {}
  $installed = 0
  try { $installed = [int64](((Get-Item -LiteralPath $p.InstallLocation).CreationTimeUtc - [datetime]'1970-01-01').TotalMilliseconds) } catch {}
  $store += @{
    full = $p.PackageFullName
    family = $p.PackageFamilyName
    pkgName = $p.Name
    name = $name
    publisher = $publisher
    version = "$($p.Version)"
    location = $p.InstallLocation
    logo = $logo
    installed = $installed
  }
}

@{ reg = @($reg); steam = @($steam); epic = @($epic); store = @($store); steamPath = "$steamPath" } | ConvertTo-Json -Depth 4 -Compress
