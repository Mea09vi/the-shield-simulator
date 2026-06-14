# scripts/cables — Submarine cable data pipeline

Build/diagnostic scripts that generate `cables-static.js` (lives at the **repo
root**, loaded by the simulator). All scripts anchor their paths to this folder
via `$PSScriptRoot`, so they run correctly from any working directory.

> ⚠️ **Do not run a converter casually.** Both converters write to
> `../../cables-static.js` at the repo root. The deployed data comes from the
> **TeleGeography** pipeline; running the legacy Overpass converter would
> overwrite it with lower-fidelity OSM data.

## Active pipeline (TeleGeography)

This is what produced the deployed `cables-static.js` (`version 0.2`).

| File | Role |
| --- | --- |
| `tg-cables-raw.json` | Raw input — TeleGeography Submarine Cable Map GeoJSON snapshot (2026-05-28). |
| `_convert_tg.ps1` | **Generator.** Filters to the Andaman + Gulf of Thailand + SCS bbox (lat 0–15N, lon 95–115E) and writes `../../cables-static.js`. |
| `_filter_tg.ps1` | Diagnostic only (console output) — reports which cables touch the Gulf / pass near Sattahip. Writes nothing. |

**To refresh:** re-fetch the GeoJSON into `tg-cables-raw.json`, then:

```powershell
pwsh scripts/cables/_convert_tg.ps1
```

Source: <https://www.submarinecablemap.com/api/v3/cable/cable-geo.json>
License: © TeleGeography — free for non-commercial display.

## Legacy pipeline (Overpass / OpenStreetMap) — reference only

Superseded by the TeleGeography pipeline. Kept for provenance. **Running this
overwrites the deployed data.**

| File | Role |
| --- | --- |
| `cables-overpass-raw.json` | Raw input — Overpass API snapshot (2026-05-28), ODbL © OpenStreetMap contributors. |
| `_convert_cables.ps1` | Old generator (`version 0.1`). Writes `../../cables-static.js` from the Overpass data. |
| `_check_gulf.ps1` | Diagnostic only (console output) — counts Overpass cable points inside the Gulf bbox and near Sattahip. |
| `_inspect.ps1` | Diagnostic only (console output) — lists Overpass elements with tags and point counts. |

## Naming note

The leading `_` on the `.ps1` files is a deliberate "scratch / build tool"
marker — these are not part of the deployed site, only used to regenerate data.
