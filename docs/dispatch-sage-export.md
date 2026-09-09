# Dispatch — The Sage Round-Trip

How `dispatch.html` turns an imported Sage CSV into the nightly dispatch export.
The guiding principle: **the export is the original file, surgically edited** —
never a file rebuilt from scratch — so Sage's importer accepts it every time.
(Applies identically to `TX.html`.)

---

## 1. Import — the source file is preserved byte-for-byte

When a Sage CSV is imported, two things happen:

1. **The raw file is stashed** in `DB.sageImport`:
   - `filename`, `headerLine`, `importedAt`
   - `rows[]` — every data row with its original index (`idx`), the **untouched
     raw line** (`raw`), and the parsed `fields`
2. **Jobs are created** from the parsed records through the normal pipeline
   (task mapping, sub resolution, geocoding). Each job remembers which raw row
   it came from via `job.sageRowIdx`.

Importing wipes the prior state first (`DB.jobs`, `DB.sageImport`,
`pendingSubReview`, cached routes) so **this CSV is the single source of truth
for the round-trip** — you can't accidentally export last week's rows.

Key columns (by position, quote-aware):
`RDATE, Servicer_Id (col 1), Status_Code (col 2), Builder, Master_Job, …,
Sub, Section, TASK, Priority, Division`.

## 2. What you do in between

Assign jobs to crews anywhere — command center columns, routing timeline,
lasso, map. The only thing the export cares about is the final `job.crew` on
each job and each crew's **Sage Field #** in the crew library.

## 3. Export — one pass over the original rows

`exportToSage()` walks `DB.sageImport.rows` **in original file order** and
applies one rule per row:

| Row situation | What the export does |
|---|---|
| `Status_Code = OUT`, assigned to a crew with a Field # | `Servicer_Id` ← crew's Field #, **`Status_Code` flipped `OUT → IF`**, row kept |
| `FV` or `FE`, assigned | `Servicer_Id` ← Field #, status **left as-is** (no flip), row kept |
| `CFF` | **Dropped from the CSV entirely** — Sage's validator rejects CFF rows even untouched. Assigned CFF jobs go to the companion calc-request file instead (covered in the CFF doc) |
| Unassigned, or the job was deleted in the tool | Row dropped |
| Assigned, but the crew has **no Field #** | Row dropped + one warning per crew in the log |

Counters for every branch (`assigned`, `flipped`, `cffPassed`,
`skippedUnassigned`, `skippedNoField`) feed the log line, e.g.:

```
Sage export: 42 assigned (30 flipped OUT→IF), 6 CFF dropped from CSV
(companion file only), 3 skipped (unassigned/deleted) → 2026-09-09_dispatch_FL.csv
```

## 4. Cell surgery, not file rebuilding

Edits go through `writeCell(raw, idx, value)`:

- The row is split with the **quote-aware tokenizer**, so a cell like
  `"Smith, Jones & Co."` survives the splice intact.
- If the original cell was double-quoted (newer Sage format), the new value is
  **re-wrapped in quotes** — the round-trip stays valid for either format.
- A row with fewer columns than expected is left unmodified and logged as a
  warning rather than corrupted.
- Every cell keeps its original quoting; the re-joined line is byte-identical
  except for the one or two cells that changed.

`tighten()` then trims trailing whitespace inside cells (inside the quotes when
quoted) — cosmetic cleanup Sage tolerates.

The output is `headerLine` + the surviving rows, one file:
**`YYYY-MM-DD_dispatch_FL.csv`** (today's date).

## 5. Where files land — the export folder

`saveExportFile(name, blob)` powers every export (dispatch CSV, CFF companion,
route card PDFs):

1. If an **export folder** has been picked (Settings — chosen once via the
   browser's directory picker and remembered), the file is written straight
   into it and logged as `filename → folder/`.
2. If the folder write fails (permission revoked, drive missing), it **falls
   back to a normal browser download** with a warning — the export never
   silently vanishes.

## 6. After the CSV

- **Route card PDFs** — unless turned off in Settings
  (`routeCardPDF: false`), the export also generates one schematic route card
  PDF per active crew with mapped jobs (pure jsPDF, no map tiles), dated with
  the dispatch date.
- **Dispatch history** — each export records a snapshot (`dispatchHistory`:
  date, crews, task counts, total jobs) for the copy/paste dispatch text and
  look-backs.
- A double-run guard (`_exportBusy`) stops a second click from producing
  duplicate files while an export is still writing.

## Quick troubleshooting

| Symptom | Usual cause |
|---|---|
| "no sage csv loaded" | Export clicked before importing today's CSV — the round-trip needs the source file |
| A crew's rows missing from the CSV | That crew has no Sage Field # in the crew library (one warning per crew in the log) |
| Fewer rows than the source file | Working as designed — unassigned/deleted rows and all CFF rows are dropped |
| Sage imports the file but Servicer_Id blank on some rows | Those jobs were never assigned in the tool |
