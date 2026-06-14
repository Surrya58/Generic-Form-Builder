# Form Builder

A browser-based, Google-Forms-style form builder. Design form templates, fill them out,
and export submitted responses as PDFs. **Everything lives in `localStorage`** — no backend,
no database, no server.

Two modes:

- **Builder** — design a template: add, configure, reorder, and conditionally show/require fields.
- **Fill** — instance a template, fill it out, and export the response as a PDF.

## Stack

React 18 + TypeScript (`strict`, no `any`) · Vite · Tailwind · `@dnd-kit` · React Router ·
Vitest + Testing Library (unit/component) · Playwright (E2E). PDF export is a **hand-rolled,
browser-native byte writer** — no third-party PDF library.

## Architecture

```
src/domain/       Pure engine + types. No React. 100% unit-test coverage gate.
                  ├─ conditionEngine    fixpoint resolver + cycle detection
                  ├─ calculationEngine  dependency-driven recompute
                  ├─ validationEngine   per-field, hidden-aware (fill-time)
                  └─ templateValidationEngine  builder-time template linting
src/persistence/  Pure repository over partitioned localStorage + schemaVersion/migrations.
                  Writes never throw — they return a typed StorageResult.
src/registry/     Record<FieldType, FieldDefinition>. The extensibility seam: an 11th field
                  type is one new file + one registration line, no edits elsewhere.
src/state/        React Context + useReducer. Separate Builder and Fill stores; pure reducers.
src/pdf/          Hand-rolled PDF 1.7 writer (base-14 Helvetica, xref/trailer, glyph-width wrap).
src/ui/           Presentational components: screens, builder panels, fill form, primitives.
```

The **field registry** drives the palette, config panel, fill renderer, validation, PDF rows,
and condition operators — so there is no `switch (field.type)` scattered across the app.

## Key behaviors & decisions

- **Conditional logic** is a property of every field, not a field type. Within a field, conditions
  are evaluated in array order against a single base state; show/hide and require/unrequire are
  independent axes and the **last matching condition on an axis wins** (no AND/OR combinator).
  Cross-field effects resolve to a **fixpoint**; if it doesn't stabilize, every field falls back
  to its default state and the cycle is flagged.
- **Hidden fields** are never validated, never submitted, and never feed conditions or
  calculations — a hidden field's value is treated as absent everywhere.
- **Calculations** aggregate Number fields only (never another calculation). An empty source set
  yields blank (`null`), never `0`/`NaN`.
- **Persistence** is partitioned (`fb:templates:index`, `fb:template:<id>`,
  `fb:instances:<templateId>`, drafts, `fb:trash`) so saving one record never rewrites the others.
  Every write returns `StorageResult`; on `QuotaExceededError` / unavailable storage the autosave
  **freezes** and a recovery dialog offers Export-as-JSON — no crash, no silent data loss.
- **Refresh durability** comes from URL routing + debounced **draft autosave** (Builder and Fill),
  flushed on `blur`/`visibilitychange`/`pagehide`. Submitted instances are **immutable snapshots**.
- **Snapshot isolation**: each submitted instance embeds a `templateSnapshot`, so re-downloading a
  PDF stays faithful even after the live template is edited or deleted. Visible fields for the PDF
  are recomputed from the snapshot + stored values.
- **Reordering is presentational only** — conditions/calculations reference fields by stable id, so
  reorder can never break logic.
- **Safe-reversible delete**: deleting a template cascades to its responses behind a confirm dialog
  naming the count, then a ~6s **Undo** toast backed by `fb:trash` (purged if not restored).
- **Long response lists virtualize** past 30 rows (fixed-row-height windowing) so thousands of
  responses stay cheap to render; shorter lists use natural flow layout.
- **Error boundaries** wrap the Builder and Fill routes so one bad config can't white-screen the app.
- **PDF is generated on demand and never stored** in localStorage.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit + component) |
| `npm run test:e2e` | Playwright E2E |

## Testing

Pure engines and reducers are exhaustively unit-tested (the domain layer has a 100% coverage
gate). Components are tested via Testing Library, and Playwright drives the full happy path
(build → save → fill → submit → response list) against the built app.
