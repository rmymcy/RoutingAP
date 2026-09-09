# Route4Me Workaround — anatomy, and what carries over to the dispatch tool

**As of v25 · `index.html`, 4,130 lines, one self-contained file.**

Written to answer one question: *when we fold this into the dispatch tool and drive
Route4Me with pre-assigned routes, what already exists and what has to be built?*

I have not seen the dispatch tool's source, so the "reuse" calls below are about
what this side offers. Where the dispatch tool already has its own version —
fuzzy matching and the review cards were ported **from** it originally — keep
theirs and ignore this column.

---

## 1. Why the next tool exists

Four ways to get work into Route4Me. We tested all of them:

| Path | Who assigns jobs | Start location | Uploads |
|---|---|---|---|
| Multi-depot, one file | Route4Me, freely | Real homes | 1 |
| Territories | You, by geography — **fixed** | Welded to the territory | 1 |
| Virtual homes | You, indirectly | **A fiction — sequence is wrong** | 1 |
| One depot per file | **You** | **Real home** | **N** |
| **Pre-assigned `Route ID`** | **You** | **Real home** | **1** |

Everything above the last row loses something. The last row is the goal: one
upload, our assignment, real starts, and Route4Me still doing the sequencing it
is genuinely good at.

**Status: unconfirmed.** `Route Name` was tested and only *labels* a route — the
optimizer reassigned by geography anyway. `Route ID` / `Original Route ID` is the
current candidate and is being tested with a Paul/Hunter swap file. Nothing below
should be built until that test comes back.

---

## 2. What this tool is

A single offline HTML file. No build step, no server, no dependencies except
Leaflet (vendored inline) and OpenStreetMap tiles.

```
Sage export (file01)
    └─> resolve subdivisions to coordinates
        └─> Route4Me upload (file02)
              └─> Route4Me
                    └─> Route4Me export (file03)
                          └─> Sage import (file04)  +  CFF calc requests
```

Four markets — FL, HOU, DFW, ASA — fully isolated. Only `r4m_region_v1` is
shared; every other key is prefixed (`r4m_`, `r4m_hou_`, …).

### Storage — read this before touching persistence

`localStorage` is **one ~5 MB bucket shared by every local page on the machine**,
including the dispatch tool. Anything that grows with the work must not live
there. This cost two wrong fixes to learn.

| Where | Holds | Why |
|---|---|---|
| **IndexedDB** (`idbOpen`, L1146) | subdivisions, crews, the day's raw file01 | Hundreds of MB, per-database. Works on a plain double-clicked `file://` page with no launch flags. |
| **localStorage** | small settings only — region, tab, task matrix, column choices | What it is actually for |

`hydrateLibraries()` (L1300) reads at boot and migrates anything still sitting in
localStorage. `guardedSave()` (L1275) refuses to write an empty library over a
full one and verifies after commit.

---

## 3. Module inventory

Line numbers are v25. Grouped by how portable each part is.

### 3a. Portable — no Route4Me or Sage knowledge in them

| What | Where | Notes |
|---|---|---|
| IndexedDB k/v layer | `idbOpen` L1146, `storedLibrary` L1172 | ~40 lines. Resolves on transaction commit, not on request — that distinction matters. |
| Wipe guards | `guardedSave` L1275 | Refuses empty-over-full, confirms >50% cuts, verifies after write |
| Compact sub packing | `packSubs` L1181 | Short keys, empty fields omitted. Halves a 5,600-sub library. |
| CSV in/out | `parseCSV` L1456, `toCSV` L1478, `findCol` L1489 | Quote-aware, header lookup is case/space tolerant |
| Fuzzy matching | `jaroWinkler` L1412, `scoreSubs` L1443 | Originally ported *from* the dispatch tool |
| Name normalisation | `norm` L1342, `buildIndex` L1343 | Name + alias index |
| Coordinate sanity | `geoOk` L2621, `fitCluster` L2629 | A swapped lat/lng is a legal point in the Southern Ocean and will drag a map's bounds across the planet. `fitCluster` fits to the bulk so one bad pin cannot decide the view. |
| Distance | `haversineMi` L3216 | |
| Geographic sort | `mortonKey` | Z-order interleave, map-neighbours sort adjacent |
| XLSX reading | `inflateRaw`, `zipEntries`, `parseXlsxGrid` L3023 | Hand-rolled — reads .xlsx with no library |

### 3b. The valuable domain logic — port the ideas, not necessarily the code

| What | Where | Why it matters |
|---|---|---|
| **Section-aware matching** | `subKeyForms` L1361, `matchSub` L1374 | Sage splits a place across `Subdiv Name` + `Section`; the library has one zone per phase. Matching on name alone collapses 41 Easton Park entries into one decision and puts every section on one centroid. Rebuilds the full name, falls back to the bare name. |
| **Sub resolution UI** | `openUnmatchedModal` L2473, `mountSubPicker` L2573 | One card per unresolved place, fuzzy suggestions, match / match+alias / create. Alias-saving is what makes the next import quiet. |
| **Truncation aliases** | `_saveTruncAlias` | Sage cuts names at a fixed width; a unique ≥19-char prefix is saved as an alias automatically |
| **Task settings** | `loadTaskMx` L1572, `renderTasks` L1620 | One row per Sage task name: on-site minutes, and priority on two clocks (due-date, received-date). Hottest wins. Unmapped → blank priority, never Sage's numbers. |
| **Two-clock priority** | inside `buildFile02` L1739 | ~40 lines. The business rules, and the thing hardest to re-derive. |
| **Assignment model** | `previewAssign` L2094 | Nearest start, optional stops cap, jobs placed in order of how strongly they prefer one crew — clear cases claim their owner before the toss-ups. **This is the core of the next tool.** |
| **Crew map** | `renderCrewMap` L2117, `jobPoints` L2060, `crewStarts` L2078 | Jobs coloured by crew, draggable starts, live recompute, per-crew counts and average miles. Calls out crews who would get nothing. |
| **Multi-start crews** | `crewLocs`, `crewSetLoc`, `crewAddLoc` | `c.locs=[{label,lat,lng}]`, `c.lat/lng` mirror the active one so everything downstream stays simple |
| **Sub folders** | `subFamily` L2653 | Groups phases under one openable row without merging records — 5,629 Houston subs become 1,316 top-level entries |
| **CFF requests** | `buildCffText` L2301 | Companion-file format, grouped by crew |
| **Reverse trip** | `reverseConvert` L2341, `runReverse` L2435 | file03 + file01 → the 15-column Sage import. Rows with no `Svc Job Num` are skipped, which is how depot rows stay out of file04. |

### 3c. Route4Me-specific — the part the next tool replaces

| What | Where |
|---|---|
| `buildFile02` | L1739 — the whole export |
| Column plan | inside `buildFile02` — `plan[]` / `reshape()` |
| Column header constants | `LAT_H`, `LNG_H`, `DEPOT_H`, `SVC_H`, `WINF_H`, `WINT_H` |
| Depot rows | end of `buildFile02`, gated on `DEPOTS_ON` |
| Time windows | `JOB_WINDOWS`, `openWindowModal` L3927 |

---

## 4. Data shapes

```js
// subdivision — stored packed (n/a/o/k/d/x), unpacked in memory
{ name, nickname, address, lat, lng, aliases:[] }

// crew — locs is the multi-home list; lat/lng mirror the active one
{ name, last, code, email, locs:[{label,lat,lng}], locIdx, lat, lng, active }

// task settings, per market
{ tasks:[{ name, svc, due:[4], recv:[4] }], codes:{ R:'1' } }

// a job in memory
{ cells:[...], id, removed }

// transfer bundle — one file per market, or all markets at once
{ region, subs:[…], crews:[…] }   // records may carry their own `region`
```

---

## 5. The next tool

### What changes

The pipeline is the same up to the export. Only the last step differs:

```
                                    ┌─ today ──> file02, R4Me assigns (or territories)
file01 ─> resolve ─> ASSIGN ────────┤
                                    └─ next ───> file02 with Route ID, R4Me obeys
```

`previewAssign()` stops being a *guess* at Route4Me's optimizer and becomes the
**actual assignment**. That is a strict improvement: no black box on the other
side to predict, and the crew map becomes authoritative rather than advisory.

### Export shape (pending the Route ID test)

| Column | Job rows | Depot rows |
|---|---|---|
| `Alias` | task - subdivision - address | `<crew> Home` |
| `Latitude` / `Longitude` | sub centroid | crew's **real** home |
| `Svc Job Num` | the join key | *blank* — keeps them out of file04 |
| `Depot` | blank | `1` |
| **`Route ID`** | **the crew's id** | **the same id** |
| `Route Name` | crew name (label only) | crew name |
| `Service Time` | from the task row | blank |
| `Priority` / `Color` | two-clock matrix | blank |

### Virtual homes stop being a compromise

Today a virtual home fixes assignment and breaks sequencing, because the route
starts from the fiction. With `Route ID` doing the assigning, the dragged pin
never leaves the building: it shapes **our** assignment, and the file exports the
crew's **real** home as the depot. The lie stays internal; Route4Me gets the truth.

### To build

1. `Route ID` column, sourced from the crew-map assignment
2. Depot rows on real homes, never a dragged position
3. Stable crew ids (the Servicer Id is the obvious candidate)
4. Assignment persists with the day's state, like time windows do
5. **Predicted vs actual** — file03 comes back with what Route4Me really did.
   Compare and show the hit rate. This is what turns "trust the assignment" into
   a number, and it is the objection that killed the pools idea.

### Not needed any more

Territory drawing (already removed), pools, per-crew file splitting, and the
crew-map-as-prediction framing.

---

## 6. Things that cost real time to learn

- **`localStorage` is shared with every other local page.** Not ours to budget.
- **IndexedDB works on `file://` with no flags** — ~966 MB, verified on a plain
  double-clicked page.
- **A swapped lat/lng is a legal point.** Nothing downstream objects; the map
  silently fits half the planet. Range-check before anything reaches Leaflet.
- **Depot rows need no `Svc Job Num`** — the reverse trip skips them for free.
- **`Route Name` only names.** It does not assign. Tested.
- **Leaflet is vendored inline** with the SVG renderer. Canvas was implicated in
  tab crashes on large libraries.
- **Sage truncates `Subdiv Name`** at a fixed width — the prefix-alias path is
  not optional.
- **Route4Me's importers differ.** The Orders import and the route-planning
  upload accept different fields; a `Depot` value that works in one reads as
  "No" in the other. Some of it is a Route4Me account setting.

---

## 7. Test suite

24 Playwright files in the scratchpad, run headless against `file://`.

```
executablePath: '/opt/pw-browsers/chromium'   # no launch flags — as a manager opens it
```

Worth carrying over in spirit: they run against the **real Houston and Florida
libraries**, not fixtures. That is how the crew-starving problem surfaced (1 of 16
crews with nothing) and how the section collapse was caught (Woodforest 1/10/101/103
sharing one centroid). Tests built on invented data would have passed.
