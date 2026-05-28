$j = Get-Content cables-overpass-raw.json -Raw | ConvertFrom-Json
Write-Host "total elements:" $j.elements.Count
$j.elements | ForEach-Object {
    $t = $_.tags
    $name = if ($t.name) { $t.name } elseif ($t.'seamark:name') { $t.'seamark:name' } else { '(unnamed)' }
    $pts = if ($_.geometry) { $_.geometry.Count } else { 0 }
    Write-Host ("id={0,-12} pts={1,-4} sm={2,-18} mm={3,-18} name={4}" -f $_.id, $pts, $t.'seamark:type', $t.'man_made', $name)
}
