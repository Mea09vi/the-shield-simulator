$j = Get-Content cables-overpass-raw.json -Raw | ConvertFrom-Json
$inGulf = 0
$gulfNames = @{}
$allNames = @{}
foreach ($el in $j.elements) {
    if (-not $el.geometry) { continue }
    $name = if ($el.tags.name) { $el.tags.name } else { "(unnamed) #$($el.id)" }
    $allNames[$name] = $el.geometry.Count
    foreach ($g in $el.geometry) {
        # Gulf of Thailand bbox: 6-14N, 99.5-105E (excludes Malacca/Singapore)
        if ($g.lat -ge 6.0 -and $g.lat -le 14.0 -and $g.lon -ge 99.5 -and $g.lon -le 105.0) {
            $inGulf++
            if ($gulfNames.ContainsKey($name)) { $gulfNames[$name] = $gulfNames[$name] + 1 }
            else { $gulfNames[$name] = 1 }
        }
    }
}
Write-Host "TOTAL points inside Gulf of Thailand bbox (6-14N, 99.5-105E):" $inGulf
Write-Host ""
Write-Host "Cables with points IN Gulf:"
$gulfNames.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { Write-Host (" {0,5}  {1}" -f $_.Value, $_.Key) }
Write-Host ""
Write-Host "Cables near Sattahip (12-13.5N, 100-102E):"
foreach ($el in $j.elements) {
    if (-not $el.geometry) { continue }
    $name = if ($el.tags.name) { $el.tags.name } else { "(unnamed) #$($el.id)" }
    $near = 0
    foreach ($g in $el.geometry) {
        if ($g.lat -ge 12.0 -and $g.lat -le 13.5 -and $g.lon -ge 100.0 -and $g.lon -le 102.0) { $near++ }
    }
    if ($near -gt 0) { Write-Host (" {0,5}  {1}" -f $near, $name) }
}
