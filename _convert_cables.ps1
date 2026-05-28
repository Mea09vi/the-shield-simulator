$j = Get-Content cables-overpass-raw.json -Raw | ConvertFrom-Json

$header = @"
/* ────────────────────────────────────────────────────────────────────────
   THE SHIELD 2.0 — UDC Simulator v13 · Static Submarine Cable Data
   ────────────────────────────────────────────────────────────────────────
   ที่มา        : Overpass API — snapshot 2026-05-28
   bbox        : 0.5,98.0,14.0,110.0  (Gulf of Thailand + Andaman + SCS)
   tags filter : seamark:type=cable_submarine OR man_made=submarine_cable
                 OR (communication:medium=fibre AND location=underwater)
   licence     : ODbL · © OpenStreetMap contributors
   อัปเดต      : รัน _convert_cables.ps1 หลัง re-fetch cables-overpass-raw.json
   หมายเหตุ    : พิกัด OSM ก็เป็นการประมาณการเช่นกัน (ภาคพิเศษ ±100m-1km)
   ──────────────────────────────────────────────────────────────────────── */
window.MDA_CABLES_STATIC = {
    "version": 0.1,
    "generator": "Overpass API snapshot 2026-05-28",
    "elements": [
"@

$lines = @($header)
$cnt = 0
foreach ($el in $j.elements) {
    if (-not $el.geometry -or $el.geometry.Count -lt 2) { continue }
    $name = if ($el.tags.name) { $el.tags.name } elseif ($el.tags.'seamark:name') { $el.tags.'seamark:name' } else { '' }
    $nameJson = $name -replace '\\','\\\\' -replace '"','\"'
    # Round to 5 dp (~1m precision) for compactness
    $coords = ($el.geometry | ForEach-Object {
        '[{0:F5},{1:F5}]' -f $_.lat, $_.lon
    }) -join ','
    $lines += ('        {"id":' + $el.id + ',"name":"' + $nameJson + '","coords":[' + $coords + ']},')
    $cnt++
}
# Trim trailing comma on last element
if ($lines.Count -gt 1) {
    $lines[-1] = $lines[-1].TrimEnd(',')
}
$lines += '    ]'
$lines += '};'
$lines += "console.log('[MDA·Cables] static data loaded:', window.MDA_CABLES_STATIC.elements.length, 'ways');"

Set-Content -Path cables-static.js -Value ($lines -join "`r`n") -Encoding UTF8
Write-Host "wrote cables-static.js with $cnt ways"
Write-Host "file size:" ((Get-Item cables-static.js).Length) "bytes"
