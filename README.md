# RoutingAP

Two browser tools that move survey work between Sage and the field, plus the
documentation for folding them together.

## Source

- `dispatch.html` — the dispatch tool. One self-contained offline file,
  8,912 lines. Imports a Sage CSV, assigns jobs to crews, and writes the
  nightly dispatch export back out.

The Route4Me workaround (`index.html`, v25) is **not** in this repository. Only
its annotated source listing is, and that listing omits the vendored Leaflet
blob, so the tool cannot be rebuilt from it.

## Documentation

- [Dispatch — the Sage round-trip](docs/dispatch-sage-export.md) — how
  `dispatch.html` turns an imported Sage CSV into the nightly export.
- [Tool anatomy and reuse](docs/tool-anatomy-and-reuse.md) — what the Route4Me
  workaround contains, which parts are portable, and what has to be built to
  drive Route4Me with pre-assigned routes.
- [Route4Me workaround — full source](docs/route4me-workaround-source.md) —
  the annotated listing of `index.html`.
