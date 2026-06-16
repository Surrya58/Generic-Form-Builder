# Claude Build Notes — Architecture & Decision Record

> **What this is.** How this Form Builder was designed and built with Claude: the architecture
> we chose, and the decision *rationale* behind it ("what was the decision based on which we are
> solving this"). It's a synthesis/index over the two design documents kept in [`docs/`](docs/):
>
> - [`docs/PHASED_PROMPTS.md`](docs/PHASED_PROMPTS.md) — the living build spec (locked decisions, schema, engine contracts, edge-case catalog, testing, and the phased build prompts; revisions r1–r5).
> - [`docs/SCHEMA_DESIGN_REPORT.md`](docs/SCHEMA_DESIGN_REPORT.md) — the data-model deep-dive (templates, responses, timestamps, autosave) with every decision, its alternatives, and its trade-off.
>
> Read those for depth; read this for the map.

---

## 1. How it was built — a design-first, phased, prompt-driven approach

The project was **designed before it was coded**. `PHASED_PROMPTS.md` was authored and iterated
(r1→r5) as the single source of truth — locking the tech stack, the data schema, the pure-engine
contracts, the edge cases, and the test strategy — *then* the implementation was driven phase by
phase. Each phase is a self-contained prompt with explicit acceptance criteria, and no phase begins
until the prior phase is green.

| Phase | Goal | Key deliverables |
|---|---|---|
| 1 | Scaffold & types | Vite + React + TS (strict), Tailwind, Vitest, Playwright, React Router; the full domain schema |
| 2 | Persistence | Partitioned-localStorage repository, `StorageResult`, `probeStorage`, migration runner, draft + trash, pure autosave core |
| 3 | Pure engines | `conditionEngine` (fixpoint + cycles), `calculationEngine`, `validation`, `templateValidation` — no React, 100% covered |
| 4 | Field registry | `FieldDefinition<T>`, 9 field types (one file each), accessible primitives (Modal, Dropdown, Radio/Tiles, `SortableList`) |
| 5 | Builder mode | 3-panel builder, drag-and-drop (3 surfaces), conditional/calc editors, autosave + Save/Discard, Preview |
| 6 | Fill mode | Live conditional/calc rendering, validation + error summary, autosave, submit → immutable instance |
| 7 | PDF export | Hand-rolled browser-native PDF writer (base-14 fonts), generated on demand |
| 8 | Lists & nav | Templates list, instances list, search/sort, safe-reversible cascade delete |
| 9 | Hardening & CI | Error boundaries, a11y, responsive, README, GitHub Actions |

(The nine phases were also packaged as five larger "build prompts" for hand-off; both forms live in `PHASED_PROMPTS.md`.)

---

## 2. The architecture we chose

The governing principle: **business logic is pure TypeScript with zero React; UI is a thin layer
over it.** That is what makes the hard parts (conditional logic, calculations, validation, PDF,
storage) exhaustively unit-testable, and what makes the app extensible.

```
UI Layer (React)          src/ui — screens · builder/ · fill/ · form/ · primitives/ · persistence/
                          Presentational; reads stores, calls engines.
        │
State Layer               src/state — BuilderContext + FillContext (Context + useReducer),
                          pure reducers, listOperations (moveItem/insertField), fillSubmission
        │
Domain / Engine Layer     src/domain — PURE, no React, 100% unit-tested:
                          conditionEngine · calculationEngine · validationEngine · templateValidationEngine
                          + the schema (field, condition, template, instance, primitives)
        │
Field Registry            src/registry — Record<FieldType, FieldDefinition>; the extensibility seam.
                          An 11th field type = ONE new file + ONE registry entry. No switch(type) elsewhere.
        │
Persistence Layer         src/persistence — repository over PARTITIONED localStorage keys,
                          storageAdapter (mockable), migrations (migrate-on-read), autosave core,
                          probeStorage, StorageResult, id
        │
PDF                       src/pdf — hand-rolled byte writer (buildPdf, layout, pdfString, helveticaWidths)
```

**Locked stack & cross-cutting choices** (from `PHASED_PROMPTS.md`):

- **React 18 + TypeScript `strict`, no `any`** · **Vite** · **Tailwind-only** (we hand-built the accessible primitives) · **React Router**.
- **State = React Context + `useReducer`** (two contexts), not an external store — reducers stay pure and testable.
- **Drag-and-drop = dnd-kit** (headless), **grip-handle**-initiated, with up/down + full keyboard fallback, across three surfaces (palette→canvas, canvas reorder, options reorder).
- **PDF = hand-rolled**, browser-native only (no PDF library), generated on demand and **never stored**.
- **Testing = Vitest** (pure engines + components, 100% `src/domain` coverage gate) **+ Playwright** (step-annotated E2E).

---

## 3. The decisions and *why* (decision ledger)

The load-bearing schema/architecture decisions and the reason each was chosen **for this app**
(no backend, localStorage-only, graded on product thinking, extensibility, type safety, conditional
correctness, PDF quality, refresh durability). Full alternatives-and-trade-offs analysis is in
`SCHEMA_DESIGN_REPORT.md` §"Consolidated decision ledger".

| # | Decision | Rather than… | Why, for this app |
|---|----------|--------------|-------------------|
| 1 | **Embed a frozen `templateSnapshot` in every `FormInstance`** | reference the live template by id | No backend to version templates — a submitted response (and its re-exported PDF) must stay faithful *after* the template is edited or deleted. The snapshot is the response's frozen world. |
| 2 | **Separate mutable `Draft`, distinct from immutable `FormInstance` and committed `Template`** | a `status: draft\|submitted` flag on one record | Refresh durability needs an in-progress store that survives reload **without** corrupting committed data; immutability must be structural, not a flippable flag. |
| 3 | **Partitioned localStorage keys** (`fb:template:<id>`, `fb:instances:<templateId>`, `fb:draft:*`, `fb:templates:index`, `fb:trash`) | one monolithic JSON blob | A debounced autosave that rewrote *all* data per keystroke would amplify write cost + quota pressure. One draft write touches one key; the home list reads only the small index. |
| 4 | **Typed `StorageResult<T>` from every write (never throw)** | let `QuotaExceededError` propagate | localStorage is the *only* store; a quota/unavailable failure must become a recovery dialog with Export-as-JSON, **not a white screen**. The type forces callers to handle `quota`/`unavailable`/`unknown`. |
| 5 | **`schemaVersion` on `Template` + `TemplateSnapshot`, migrated on read** | no version field / migrate-on-write / one global version | Persisted data outlives any deploy; users return with old blobs. Migrate-on-read upgrades lazily, and snapshots carry their *own* version so old responses migrate independently. |
| 6 | **Mapped discriminated union for `Field`** | a fat optional-everything interface, or `config: unknown` | Narrowing on `.type` yields the matching config *and* value types. Adding an 11th type is one key in `FieldConfigMap`; TS then forces every `assertNever` switch + the registry to follow. |
| 7 | **`conditions[]` is a property of every field, not a 10th field type** | a dedicated "conditional logic" field type | Logic applies *to* fields (show/hide/require) — it isn't something dropped on the canvas. As a property it composes with all 9 types and the engine sees a flat, order-independent graph. |
| 8 | **Reference fields/options by stable `crypto.randomUUID` id; array order is presentational** | reference by array index or label | Reorder is first-class UX; index/label references would silently rebind logic on every move/rename. Stable IDs make reordering a guaranteed no-op for correctness. |
| 9 | **Dropped redundant `required`; `defaultRequired`/`defaultVisibility` are the base states** | keep both `required` and `defaultRequired` | Effective required/visible is *computed* (base + matching effects, last-match-wins). A second source creates ambiguous-base "which one wins" bugs. |
| 10 | **`fileUpload` stores `FileMeta[]` (metadata only, never bytes)** | base64 the file bytes into localStorage | A few real files would exhaust the quota; the PDF renders a "file content not included" note. Metadata is enough for validation + a faithful PDF row. |
| 11 | **PDF generated on demand from snapshot + values, never persisted** | store the generated PDF blob | `visibleFieldIds` are recomputed by running the condition engine over the snapshot, so re-download is deterministic; a stored blob would drift and bloat the quota. |
| 12 | **Dates are `ISODate` (`YYYY-MM-DD`) strings, compared as strings** | `Date` objects / epoch millis | Form dates are local calendar dates; string compare is timezone-proof (no `new Date()` off-by-one) and serializes losslessly. |
| 13 | **`createdAt`/`updatedAt` (Template), `submittedAt` (Instance), `updatedAt` (Draft) as ISO-8601 UTC** | a single timestamp / none | Lists sort by last-modified; the autosave pill shows relative "saved" time; the PDF prints `submittedAt`. Each answers a concrete UI question. |
| 14 | **Safe-reversible cascade delete via temporary `fb:trash` + ~6s Undo** | hard delete, or soft-delete flags that linger | Deleting a template must delete its responses (no orphans) but a misclick must be recoverable without a backend trash bin. |
| 15 | **`ConditionValue` union incl. `{ min, max }`** | a scalar `value` + separate `valueMax` | `withinRange` needs a pair; a union member keeps the editor "per (target type × operator)" and makes incomplete values *inert*, not errors. |
| 16 | **Boot-time `probeStorage()`** | discover storage failure lazily on first write | Private mode / blocked cookies / sandboxed iframes silently swallow writes; probing at boot warns up front and offers an export-only path. |

**How they interlock:** snapshot (#1) + per-record version (#5) keep old responses forward-compatible;
separate draft (#2) + partitioned keys (#3) + `StorageResult` (#4) give the submit-failure safety net
(a full disk can never destroy a completed response); mapped union (#6) + migrate-on-read (#5) let an
11th type ship without stranding data; conditions-as-property (#7) + stable-ID references (#8) make
reorder a no-op for correctness — which is *why* the redundant `required` could be dropped (#9).

---

## 4. Conditional logic — the correctness centerpiece

The hardest requirement (chained conditions, hidden-but-required, real-time updates) is solved by a
**fixpoint resolver with cycle detection** in `src/domain/conditionEngine`:

- A hidden field's value is treated as **absent** to downstream conditions/calcs, so the engine
  iterates to a stable `{visible, required}` set; if it doesn't converge (a cycle), it falls back
  deterministically to each field's default and surfaces a builder warning.
- Two independent effect axes (`show/hide`, `require/unrequire`); multiple conditions → **last-match-wins per axis**.
- Hidden fields are **never validated**, **never submitted**, and **excluded from the PDF**.
- Dangling references (deleted target / stale option id) are **inert + flagged**, never a crash.

---

## 5. Edge cases & testing posture

- **Unit (Vitest):** the four engines exhaustively (operators × types, chained, hidden-value
  exclusion, cycles, empty-set calc → blank, calc-source-calc rejection), the repository
  (`StorageResult` mapping, migration, partition proof), the autosave controller (debounce/flush/
  freeze with fake timers), reducers, and per-field component round-trips. **100% coverage gate on `src/domain`.**
- **E2E (Playwright, step-annotated):** build → validate → preview → fill → submit → PDF; refresh
  durability; snapshot integrity (re-download after editing the template); quota recovery; delete +
  Undo. Run watchable in slow-motion via `npm run test:e2e:watch` (UI/headed/report variants too).

---

## 6. Where it lives in the code

| Concern | Location |
|---|---|
| Schema (types) | `src/domain/{primitives,field,condition,template,instance,validation}.ts` |
| Pure engines | `src/domain/{conditionEngine,calculationEngine,validationEngine,templateValidationEngine}.ts` |
| Field registry | `src/registry/{types,index,icons}.ts`, `src/registry/fields/*` |
| Persistence | `src/persistence/{repository,storageAdapter,keys,migrations,autosave,probeStorage,types,id}.ts` |
| State | `src/state/{BuilderContext,FillContext,builderReducer,fillReducer,listOperations,fillSubmission}.ts` |
| UI | `src/ui/{screens,builder,fill,form,primitives,persistence}/*` |
| PDF writer | `src/pdf/{buildPdf,layout,pdfString,helveticaWidths}.ts` |
| E2E tests | `tests/*.spec.ts` |

---

## References

- [`docs/PHASED_PROMPTS.md`](docs/PHASED_PROMPTS.md) — full build spec, engine contracts, edge-case catalog, phased prompts.
- [`docs/SCHEMA_DESIGN_REPORT.md`](docs/SCHEMA_DESIGN_REPORT.md) — full schema deep-dive with per-decision alternatives and trade-offs.
