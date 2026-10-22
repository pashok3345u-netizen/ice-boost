# Draws the IceBoost icon (teal ice tile + dark lightning bolt) and writes
# build/icon.png (512px) and build/icon.ico (16..256px) next to this script.
# Run: powershell -ExecutionPolicy Bypass -File build\make-icon.ps1
Add-Type -AssemblyName System.Drawing

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = $size / 64.0

  # rounded tile
  $m = 2 * $s; $w = 60 * $s; $r = 32 * $s
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($m, $m, $r, $r, 180, 90)
  $path.AddArc($m + $w - $r, $m, $r, $r, 270, 90)
  $path.AddArc($m + $w - $r, $m + $w - $r, $r, $r, 0, 90)
  $path.AddArc($m, $m + $w - $r, $r, $r, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, 0), (New-Object System.Drawing.PointF $size, $size), ([System.Drawing.Color]::Black), ([System.Drawing.Color]::Black)
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
  $blend.Colors = @(
    [System.Drawing.Color]::FromArgb(255, 0xD9, 0xE7, 0xE8),
    [System.Drawing.Color]::FromArgb(255, 0x7D, 0xB4, 0xC2),
    [System.Drawing.Color]::FromArgb(255, 0x3F, 0x6F, 0x7C)
  )
  $blend.Positions = @(0.0, 0.45, 1.0)
  $brush.InterpolationColors = $blend
  $g.FillPath($brush, $path)

  # glossy highlight on big sizes
  if ($size -ge 48) {
    $hl = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 255, 255, 255))
    $g.FillEllipse($hl, 8 * $s, 5 * $s, 26 * $s, 9 * $s)
  }

  # lightning bolt
  $pts = @(@(36, 9), @(18, 36), @(30, 36), @(26, 55), @(46, 26), @(33, 26)) | ForEach-Object {
    New-Object System.Drawing.PointF ([single]($_[0] * $s)), ([single]($_[1] * $s))
  }
  $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0x25, 0x25, 0x2B))
  $g.FillPolygon($dark, [System.Drawing.PointF[]]$pts)
  $g.Dispose()
  return $bmp
}

$dir = $PSScriptRoot
$big = New-IconBitmap 512
$big.Save((Join-Path $dir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$big.Dispose()

# .ico with PNG-compressed images inside (supported since Windows Vista)
$sizes = 16, 24, 32, 48, 64, 128, 256
$images = foreach ($sz in $sizes) {
  $b = New-IconBitmap $sz
  $ms = New-Object System.IO.MemoryStream
  $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()
  , $ms.ToArray()
}
$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $out
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $sz = $sizes[$i]; $data = $images[$i]
  $bw.Write([byte]($(if ($sz -ge 256) { 0 } else { $sz })))
  $bw.Write([byte]($(if ($sz -ge 256) { 0 } else { $sz })))
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$data.Length); $bw.Write([uint32]$offset)
  $offset += $data.Length
}
foreach ($data in $images) { $bw.Write($data) }
$bw.Flush()
[IO.File]::WriteAllBytes((Join-Path $dir 'icon.ico'), $out.ToArray())
"icon.png + icon.ico written"
