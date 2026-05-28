# Filter TeleGeography GeoJSON to bbox covering Gulf of Thailand + Andaman + SCS
# Output: cables-tg-static.js with same shape as cables-static.js
$j = Get-Content tg-cables-raw.json -Raw | ConvertFrom-Json
Write-Host "Total cables in TG dataset:" $j.features.Count

# Bbox of interest: lat 0-15, lon 95-115 (wider to catch any cable that passes near)
$minLat = 0.0;  $maxLat = 15.0
$minLon = 95.0; $maxLon = 115.0

$out = New-Object System.Collections.ArrayList
$totalPts = 0
$cablesNearSattahip = @()
foreach ($f in $j.features) {
    if (-not $f.geometry -or $f.geometry.type -ne 'MultiLineString') { continue }
    $name = $f.properties.name
    $id = $f.properties.id
    # filter coords to bbox
    $kept = New-Object System.Collections.ArrayList
    $touchesGulf = $false
    $nearSattahip = $false
    foreach ($line in $f.geometry.coordinates) {
        $segment = New-Object System.Collections.ArrayList
        foreach ($pt in $line) {
            $lon = [double]$pt[0]; $lat = [double]$pt[1]
            if ($lat -ge $minLat -and $lat -le $maxLat -and $lon -ge $minLon -and $lon -le $maxLon) {
                [void]$segment.Add(@($lat, $lon))
                if ($lat -ge 6.0 -and $lat -le 14.0 -and $lon -ge 99.5 -and $lon -le 105.0) { $touchesGulf = $true }
                if ($lat -ge 12.0 -and $lat -le 13.5 -and $lon -ge 100.0 -and $lon -le 102.0) { $nearSattahip = $true }
            } else {
                if ($segment.Count -ge 2) { [void]$kept.Add($segment) }
                $segment = New-Object System.Collections.ArrayList
            }
        }
        if ($segment.Count -ge 2) { [void]$kept.Add($segment) }
    }
    if ($kept.Count -eq 0) { continue }
    foreach ($seg in $kept) {
        $totalPts += $seg.Count
        [void]$out.Add(@{ id = $id; name = $name; coords = $seg; gulf = $touchesGulf })
    }
    if ($nearSattahip) { $cablesNearSattahip += $name }
}

Write-Host ""
Write-Host "Cables/segments in bbox:" $out.Count
Write-Host "Total points:" $totalPts
Write-Host ""
Write-Host "Cables touching Gulf of Thailand (6-14N, 99.5-105E):"
$out | Where-Object { $_.gulf } | Group-Object name | ForEach-Object { Write-Host (" {0,3} segments  {1}" -f $_.Count, $_.Name) }
Write-Host ""
Write-Host "Cables NEAR Sattahip (12-13.5N, 100-102E):"
$cablesNearSattahip | Sort-Object -Unique | ForEach-Object { Write-Host "  $_" }
