# Convert TeleGeography GeoJSON -> cables-static.js (real cable paths)
# ACTIVE pipeline: this is the generator that produced the deployed cables-static.js.
# Paths are anchored to this script's own folder so it runs from any working dir.
# Input (tg-cables-raw.json) lives beside this script in scripts/cables/;
# output cables-static.js is written to the repo root where the simulator loads it.
$ScriptDir = $PSScriptRoot
$RepoRoot  = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path
$inFile    = Join-Path $ScriptDir 'tg-cables-raw.json'
$outFile   = Join-Path $RepoRoot  'cables-static.js'
$j = Get-Content $inFile -Raw | ConvertFrom-Json

$minLat = 0.0;  $maxLat = 15.0
$minLon = 95.0; $maxLon = 115.0

$header = @"
/* THE SHIELD 2.0 - UDC Simulator v13 - Static Submarine Cable Data
   ---------------------------------------------------------------
   Source      : TeleGeography Submarine Cable Map (public GeoJSON)
                 https://www.submarinecablemap.com/api/v3/cable/cable-geo.json
   Snapshot    : 2026-05-28
   Bbox        : lat 0-15N, lon 95-115E (Andaman + Gulf of Thailand + SCS)
   License     : (c) TeleGeography - free for non-commercial display
                 (submarinecablemap.com Terms of Use)
   Refresh     : run _convert_tg.ps1 after re-fetching tg-cables-raw.json
   Note        : Approximate routes - actual cable paths are proprietary.
                 TeleGeography is the industry-standard reference. */
window.MDA_CABLES_STATIC = {
    "version": 0.2,
    "generator": "TeleGeography Submarine Cable Map - snapshot 2026-05-28",
    "source": "submarinecablemap.com",
    "license": "(c) TeleGeography - non-commercial display",
    "elements": [
"@

$lines = New-Object System.Collections.ArrayList
[void]$lines.Add($header)
$cnt = 0
foreach ($f in $j.features) {
    if (-not $f.geometry -or $f.geometry.type -ne 'MultiLineString') { continue }
    $name = if ($f.properties.name) { $f.properties.name } else { '' }
    $id = if ($f.properties.id) { $f.properties.id } else { 'unknown' }
    $nameJson = $name -replace '\\','\\\\' -replace '"','\"'
    $idJson   = ($id   -replace '\\','\\\\' -replace '"','\"')
    foreach ($line in $f.geometry.coordinates) {
        $segCoords = New-Object System.Collections.ArrayList
        foreach ($pt in $line) {
            $lon = [double]$pt[0]; $lat = [double]$pt[1]
            if ($lat -ge $minLat -and $lat -le $maxLat -and $lon -ge $minLon -and $lon -le $maxLon) {
                [void]$segCoords.Add(('[{0:F5},{1:F5}]' -f $lat, $lon))
            } else {
                if ($segCoords.Count -ge 2) {
                    $coordsStr = $segCoords -join ','
                    [void]$lines.Add(('        {"id":"' + $idJson + '","name":"' + $nameJson + '","coords":[' + $coordsStr + ']},'))
                    $cnt++
                }
                $segCoords = New-Object System.Collections.ArrayList
            }
        }
        if ($segCoords.Count -ge 2) {
            $coordsStr = $segCoords -join ','
            [void]$lines.Add(('        {"id":"' + $idJson + '","name":"' + $nameJson + '","coords":[' + $coordsStr + ']},'))
            $cnt++
        }
    }
}
# Trim trailing comma on last segment
if ($lines.Count -gt 1) { $lines[$lines.Count-1] = $lines[$lines.Count-1].TrimEnd(',') }
[void]$lines.Add('    ]')
[void]$lines.Add('};')
[void]$lines.Add("console.log('[MDA Cables] TeleGeography snapshot:', window.MDA_CABLES_STATIC.elements.length, 'segments');")

[System.IO.File]::WriteAllText(
    $outFile,
    ($lines -join "`r`n"),
    (New-Object System.Text.UTF8Encoding $true)
)
Write-Host "wrote cables-static.js with $cnt segments"
Write-Host "file size:" ((Get-Item $outFile).Length) "bytes"
