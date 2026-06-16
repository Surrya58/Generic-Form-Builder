# Form Builder — Phased Build Prompts (Living Document)

> **Purpose.** This is the single source of truth for building the Form Builder. It holds the
> shared project context, locked technical decisions, the data schema, the engine contracts,
> the edge-case catalog, and a sequence of **self-contained prompts** (one per phase) that can
> be handed to an implementer (human or AI) to build the project incrementally.
>
> **This file is revised as the design evolves.** Every change is recorded in the Revision Log.
> When a decision changes, update the relevant section *and* add a Revision Log entry.

---

## Revision Log

| Rev | Date | Change |
|-----|------|--------|
| r1  | 2026-06-14 | Initial draft. Locked: Context+useReducer, Tailwind-only, hand-rolled PDF writer. 9 phases defined. Added schema, engine contracts, edge-case catalog, testing strategy. |
| r2  | 2026-06-14 | Drag-and-drop review. Locked: **dnd-kit** (headless) for all three DnD surfaces; **dedicated grip handle** initiates drag. Added §2 Drag-and-drop design, reorder edge cases (§5), pure-reducer + deterministic-path DnD testing (§6), expanded Phase 4 (options reorder) and Phase 5 (full DnD UX). |
| r3  | 2026-06-14 | Gap-review additions. **Schema fix:** dropped redundant `required` — `defaultRequired`/`defaultVisibility` are the base states ("Required toggle" → `defaultRequired`). Added: `templateValidation` (builder-time) engine; **routing + refresh-durability + draft autosave** (builder & fill); instance lifecycle (draft→immutable); referential integrity on field/option/template deletion; date/timezone rules; submit error-summary + focus-first-invalid a11y; per-operator condition value editor; `crypto.randomUUID` IDs; file-type matching rules; security note; template-title default; re-download recomputes visibility from snapshot; domain coverage gate; support types (`ValidationError`/`ValidationCtx`, `PdfRow`, `TemplateIssue`). **Pending confirmation:** routing library + template-delete cascade behavior. |
| r4  | 2026-06-14 | Resolved pending decisions. **Routing: React Router.** **Template delete: safe-reversible cascade** — confirm dialog naming the response count + a ~6s **Undo** toast backed by a temporary `fb:trash` entry (purged if not restored). Updated §2 routing, §5 referential integrity, Phase 8, and Open Items. |
| r5  | 2026-06-14 | Made **autosave + quota-exceeded handling** execution-ready (per user request). Added §2 "Autosave & storage-failure handling": debounced autosave controller flushed on `blur`/`visibilitychange`/`pagehide`, status pill (`editing→saving→saved`/`save failed`), freeze-on-failure + Retry; typed `StorageResult<T>`; `probeStorage()` boot check; `QuotaExceededError` **recovery dialog** with Export-as-JSON + reclaim-space; Fill **submit-failure safety net**; private-mode boot banner. Wired into Phase 2 (repository `StorageResult`/`probeStorage` + pure autosave core), Phase 5 (`AutosaveStatus` + `QuotaRecoveryDialog` shared components), Phase 6 (fill autosave + submit-failure net), §5 persistence edge cases, and §6 unit + E2E tests. |

---

## 0. Scope & Intent

A browser-based form builder (Google-Forms-like, with modern-SaaS visual/interaction quality).
Two modes:

1. **Builder Mode** — design a form template by adding, configuring, and ordering fields.
2. **Fill Mode** — instance a template, fill it out, export it as a PDF.

All data lives in **localStorage**. No backend, no server, no database.

**The build deliberately optimizes for:** edge-case correctness, scalability within browser
constraints, accessibility, type safety, and automated test coverage (unit + Playwright E2E).
Basic feature mechanics are assumed; effort is spent where reliability is decided.

---

## 1. Locked Technical Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Framework | **React 18 + TypeScript (`strict`, no `any`)** | Spec requirement; types must communicate design. |
| Build tool | **Vite** | Fast dev/build, first-class Vitest integration. |
| State (transient) | **React Context + `useReducer`** (two contexts: Builder, Fill) | No extra deps; reducers are pure and unit-testable. Split contexts to contain re-renders. |
| Persistence | **Pure repository layer over partitioned localStorage** + schema versioning/migrations | Decoupled from React; testable; partition avoids whole-blob rewrites. |
| Styling | **Tailwind only**; we hand-build accessible primitives (Dropdown, Modal, Radio/Tiles group) | Spec allows any styling; we own a11y and test it. |
| PDF export | **Hand-rolled browser-native PDF byte writer** (base-14 fonts, `Blob` + anchor download) | No third-party PDF libs (spec); produces real, paginated export quality. |
| Testing | **Vitest** (unit + component via Testing Library) + **Playwright** (E2E) | Fast pure-logic tests + user-visible guarantees. |
| Lint/format | **ESLint + Prettier**, typecheck in CI | Best-practice baseline. |
| Drag-and-drop | **dnd-kit** (headless), **grip-handle**-initiated, with up/down + keyboard fallback | Accessible keyboard drag + screen-reader announcements built in; headless fits Tailwind; one small dep, lowest a11y regression risk. Not a styled component library, so consistent with "bring your own styling." |

### Field types (9) + 1 cross-cutting feature

The spec lists "10 Field Types," but **#9 Conditional Logic is a property of every field, not a
type.** Actual field types (registry keys):

`singleLineText` · `multiLineText` · `number` · `date` · `singleSelect` · `multiSelect` ·
`fileUpload` · `sectionHeader` · `calculation`

Conditional logic is a `conditions[]` property on `FieldBase`.

---

## 2. Architecture

```
UI Layer (React)            Routes: TemplatesList · Builder · Fill · InstancesList
                            Components are presentational; read stores, call engines.
        │
State Layer                 BuilderContext (reducer) · FillContext (reducer) — transient
        │
Domain / Engine Layer       PURE, no React, 100% unit-tested:
                            ├─ conditionEngine   (fixpoint resolver + cycle detection)
                            ├─ calculationEngine (dependency-driven recompute)
                            ├─ validation        (per-field, hidden-aware) — fill-time
                            ├─ templateValidation (builder-time template validity)
                            └─ pdf/              (browser-native PDF byte writer)
        │
Field Registry              Record<FieldType, FieldDefinition> — the extensibility seam.
                            An 11th type = ONE new file + ONE registry entry.
        │
Persistence Layer           repository (CRUD) → storage adapter → localStorage
                            + schemaVersion + migration runner + quota handling
```

### Extensibility seam — `FieldDefinition<T>`

Every field type is described by one self-contained definition implementing a shared interface.
Builder palette, config panel, fill renderer, validation, PDF rendering, and the condition
operator menu all derive from the registry — **no `switch (field.type)` scattered across the app.**

```ts
interface FieldDefinition<T extends FieldType> {
  type: T;
  displayName: string;
  icon: ReactNode;
  isInput: boolean;                              // false for sectionHeader

  defaultConfig(): FieldConfigMap[T];            // when added to canvas
  emptyValue(config: FieldConfigMap[T]): FieldValueMap[T];

  ConfigEditor: FC<ConfigEditorProps<T>>;        // Builder right panel
  FillRenderer: FC<FillRendererProps<T>>;        // Fill mode

  validate(config: FieldConfigMap[T], value: FieldValueMap[T], ctx: ValidationCtx): ValidationError | null;
  toPdfRows(config: FieldConfigMap[T], value: FieldValueMap[T]): PdfRow[];

  conditionOperators: Operator[];                // operators offered when this type is a target
  evaluateCondition(op: Operator, fieldValue: FieldValueMap[T], compareValue: ConditionValue): boolean;
}
```

### Drag-and-drop design

DnD is implemented once via **dnd-kit** (headless) and reused across **three surfaces**:

| # | Surface | Interactions |
|---|---------|--------------|
| 1 | Palette → Canvas | **Click** a field type = append; **drag** = insert at a chosen position |
| 2 | Canvas reorder | Reorder the field list (the main surface) |
| 3 | Options reorder | Reorder options inside Single/Multi Select config |

All three share one `<SortableList>` abstraction (dnd-kit `SortableContext` + `useSortable`),
so the interaction is built once and styled with Tailwind.

**UX rules:**
- **Dedicated grip handle (⠿)** initiates every drag; the rest of a card/row stays clickable
  (select / edit). Resolves the click-to-select vs drag-to-move conflict.
- **Drag overlay** — lifted item follows the cursor as a semi-transparent clone (no layout jump);
  a **horizontal insertion line** shows the drop target; siblings animate to make room.
- **Autoscroll** near canvas top/bottom; **activation constraint** (~5px / short delay) so a tap
  still selects rather than starting a drag.
- **Up/down buttons** on every card/row — always visible, touch-friendly, and the spec-sanctioned
  accessible fallback.
- **Keyboard drag** (dnd-kit `KeyboardSensor`): focus handle → `Space` lift → `↑/↓` move →
  `Space` drop → `Esc` cancel, with screen-reader live announcements (position N of M).
- Empty canvas shows a dropzone placeholder: *"Click or drag a field type to start."*

**Correctness invariant:** field **order is purely presentational**. Conditions/calculations
reference fields by **stable ID** and the condition engine is order-independent (fixpoint), so
reordering can never break logic and needs no ordering constraints. Reorder mutates array order
only; IDs are untouched. `Esc` mid-drag restores original order; dropping outside a valid zone is a
no-op; the selected-field state is preserved across a reorder.

**Logic lives in pure reducers, not the DnD library:** `moveItem(list, fromId, toIndex)` and
`insertField(fields, type, atIndex)` are pure, unit-tested functions. dnd-kit is only an input
device that dispatches them — which is also what makes reordering deterministically testable (§6).

### Routing & refresh durability

"The app must work correctly after a full page refresh" (spec) on **any** screen. Two mechanisms:

- **URL routing** (**React Router**). Screens are addressable so a
  refresh re-mounts the correct one and rehydrates from localStorage:
  - `/` — templates list
  - `/builder/:templateId` — Builder (edit)
  - `/fill/:templateId/:instanceId` — Fill
  - `/templates/:templateId/instances` — instances list
- **Draft autosave** keeps transient editing state across refresh:
  - *Builder*: edits autosave (debounced) to `fb:draft:template:<id>`; explicit **Save** commits to
    the canonical template record (bumps `updatedAt`, updates the index). Refresh restores the draft;
    a **Discard changes** action reverts to the last saved version.
  - *Fill*: entered values autosave (debounced) to `fb:draft:instance:<id>`; **Submit** writes the
    immutable `FormInstance` (with `templateSnapshot`) and clears the draft. Refresh mid-fill restores
    entered values, with conditional/calc state recomputed from them.

**Instance lifecycle:** a *draft* (separate, mutable storage) becomes a *submitted* `FormInstance`
on Submit. Submitted instances are **immutable** — re-download only, never edited. "New Response"
always starts a fresh draft.

### Autosave & storage-failure handling

Drafts (above) are written by a single **autosave controller** so that no keystroke is lost and
every storage failure is handled the same way, in both Builder and Fill.

**Autosave controller.**
- **Debounced** (~700 ms) write of the current draft; coalesces rapid edits into one write.
- **Flush on `blur`, `visibilitychange` (→ hidden), and `pagehide`** so closing/backgrounding the tab
  persists the last edits — losing the debounce tail is the most common "it didn't save" complaint.
- Exposes a status the UI renders as a pill: `editing → saving → saved (· relative time)` and, on
  failure, `save failed`. The pill is the user's continuous "your work is safe" signal.
- On a failed write the controller **freezes** (stops auto-retrying so it never thrashes a full
  quota), keeps the draft **in memory**, and raises the recovery dialog. A manual **Retry** re-arms it.

**Typed storage result (repository).** Writes never throw to the UI — they return a result:
```ts
type StorageResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: 'quota' | 'unavailable' | 'unknown'; message: string };

// Boot-time writability probe (private mode / blocked storage / sandboxed iframe):
function probeStorage(): 'writable' | 'unavailable';
```

**QuotaExceededError handling (no silent data loss, no crash).**
- The repository catches `QuotaExceededError` (and Safari's legacy `QUOTA_EXCEEDED_ERR`) and returns
  `{ ok: false, error: 'quota' }`.
- The UI shows a **recovery dialog** (not a crash, not a transient toast): it explains storage is
  full, keeps the in-memory draft intact, and offers escape hatches — **Export as JSON** (Blob
  download of the template/response so work is never trapped), guidance to delete old
  templates/responses to reclaim space, and **Retry**.
- **Submit-failure safety net (Fill):** if writing the immutable `FormInstance` fails on Submit, the
  fill draft is **not cleared** — the user stays on the filled form with the recovery dialog, so a
  full disk can never destroy a completed response.
- **Boot detection:** `probeStorage()` runs at startup; if storage is unavailable (private mode,
  blocked cookies, sandboxed iframe) a prominent banner warns that changes won't persist and offers an
  export-only path — better than appearing to work and losing everything on close.

---

## 3. Data Schema (the contracts)

```ts
type ISODate = string;       // 'YYYY-MM-DD'
type ISODateTime = string;   // ISO 8601

// 9 field types; conditional logic is a property, not a type.
type FieldType =
  | 'singleLineText' | 'multiLineText' | 'number' | 'date'
  | 'singleSelect'   | 'multiSelect'   | 'fileUpload'
  | 'sectionHeader'  | 'calculation';

interface Option { id: string; label: string; }
interface FileMeta { name: string; size: number; type: string; }

// Per-type config. Add an 11th type ⇒ add ONE key; TS forces registry + switches to follow.
interface FieldConfigMap {
  singleLineText: { placeholder?: string; minLength?: number; maxLength?: number; prefix?: string; suffix?: string };
  multiLineText:  { placeholder?: string; minLength?: number; maxLength?: number; rows: number };
  number:         { min?: number; max?: number; decimals: 0|1|2|3|4; prefix?: string; suffix?: string };
  date:           { prefillToday: boolean; minDate?: ISODate; maxDate?: ISODate };
  singleSelect:   { options: Option[]; display: 'radio'|'dropdown'|'tiles' };
  multiSelect:    { options: Option[]; minSelections?: number; maxSelections?: number };
  fileUpload:     { acceptedTypes: string[]; maxFiles: number };
  sectionHeader:  { size: 'xs'|'sm'|'md'|'lg'|'xl' };
  calculation:    { sourceFieldIds: string[]; aggregation: 'sum'|'avg'|'min'|'max'; decimals: number };
}

// Per-type stored value.
interface FieldValueMap {
  singleLineText: string;            multiLineText: string;
  number: number | null;             date: ISODate | null;
  singleSelect: string | null;       // optionId
  multiSelect: string[];             // optionIds
  fileUpload: FileMeta[];            // metadata only — no bytes
  sectionHeader: never;              // captures nothing
  calculation: number | null;        // computed snapshot
}

interface FieldBase {
  id: string;                        // stable UUID (crypto.randomUUID); survives reorder/rename
  label: string;                     // required for input fields; for sectionHeader it IS the content
  // Base states applied BEFORE conditions. The config "Required toggle" maps to defaultRequired.
  // Ignored for sectionHeader (non-input) and calculation (read-only).
  defaultVisibility: 'visible' | 'hidden';
  defaultRequired: boolean;
  conditions: Condition[];
}

// Whole union, derived. Narrowing on .type gives matching config + value types.
type Field = { [K in FieldType]: FieldBase & { type: K; config: FieldConfigMap[K] } }[FieldType];

type Operator =
  | 'equals' | 'notEquals' | 'contains'
  | 'gt' | 'lt' | 'withinRange'
  | 'isBefore' | 'isAfter'
  | 'containsAny' | 'containsAll' | 'containsNone';

type ConditionValue = string | number | string[] | { min: number; max: number };

interface Condition {
  id: string;
  targetFieldId: string;             // must differ from owning field
  operator: Operator;                // constrained by target field's type
  value: ConditionValue;
  effect: 'show' | 'hide' | 'require' | 'unrequire';
}

interface Template {
  id: string;
  schemaVersion: number;             // for migrations
  title: string;
  fields: Field[];                   // array order = render order
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// Snapshot the template into each instance so PDFs re-export faithfully after edits/deletes.
interface TemplateSnapshot {
  title: string;
  fields: Field[];
  schemaVersion: number;
}

interface FormInstance {
  id: string;
  templateId: string;
  templateSnapshot: TemplateSnapshot;
  values: Record<string /*fieldId*/, unknown>;   // validated against snapshot on read
  submittedAt: ISODateTime;
}

// In-progress, mutable, autosaved; cleared on submit/commit (NOT a FormInstance).
interface Draft {
  kind: 'template' | 'instance';
  refId: string;                     // templateId or instanceId
  payload: unknown;                  // partial template or partial values
  updatedAt: ISODateTime;
}

// ── Support types referenced by the engine contracts (§4)
interface ValidationError { fieldId: string; code: string; message: string; }
interface ValidationCtx   { effectiveRequired: boolean; effectiveVisible: boolean; }
interface TemplateIssue   { fieldId?: string; conditionId?: string; severity: 'error' | 'warning'; code: string; message: string; }
type PdfRow =
  | { kind: 'heading'; size: FieldConfigMap['sectionHeader']['size']; text: string }
  | { kind: 'labelValue'; label: string; value: string }
  | { kind: 'file'; label: string; files: FileMeta[] };
```

### Operators allowed per target field type

| Target type | Operators |
|---|---|
| Single/Multi-line Text | `equals`, `notEquals`, `contains` |
| Number | `equals`, `gt`, `lt`, `withinRange` |
| Single Select | `equals`, `notEquals` |
| Multi Select | `containsAny`, `containsAll`, `containsNone` |
| Date | `equals`, `isBefore`, `isAfter` |

**Condition value editor (builder).** The `value` editor renders per (target type × operator):
text → text input; number → numeric input, or a **min/max pair** for `withinRange`; single select →
option picker; multi select → **multi** option picker (`containsAny`/`containsAll`/`containsNone`);
date → date picker. An empty/incomplete value makes the condition **inert** (non-matching), never an
error at fill time.

---

## 4. Engine Contracts

### conditionEngine
- `resolve(fields: Field[], values): Map<fieldId, { visible: boolean; required: boolean }>`
- **Fixpoint**: iterate until the visibility/required state set is stable. A field's value is
  only available to conditions when that field is itself visible (hidden ⇒ value treated absent).
- **Cycle detection**: if not converged within `fields.length` iterations or a static cycle is
  found, fall back to each field's **default state** deterministically; expose a builder warning.
- **Two axes**: `show/hide` → visibility; `require/unrequire` → required. Independent.
- **Multiple conditions (documented semantics)**: evaluate in array order; each *matching*
  condition applies its effect to its axis; **last match wins**; field default is the base.
- **Dangling target** (deleted field): condition is inert; owning field uses its default.
- **Self-reference**: forbidden in UI; ignored at eval time.

### calculationEngine
- `compute(field: calculation, fields, effectiveValues): number | null`
- Sources are Number fields only; **calc may not source another calc** (blocked in UI + eval).
- Source excluded from the set when: hidden, empty/null, or deleted.
- Aggregations: `sum`, `avg`, `min`, `max`. **Empty set ⇒ `null` (blank)**, never `0`/`NaN`.
- Round result to `decimals`. Recompute is dependency-driven (reverse map source→calc).

### validation (fill-time)
- `validateField(field, effectiveValue, ctx: ValidationCtx): ValidationError | null`
- Rules: required (only when effectively required AND visible), min/max length, min/max value,
  decimals precision, min/max selections, file count + accepted-type match, date min/max bounds.
- Required multi-select means **≥ 1** selection (or `minSelections` if higher).
- File accepted-type match is **case-insensitive**, supports extensions (`.pdf`) and MIME globs
  (`image/*`); files with no extension are matched by MIME only.
- Dates are **local calendar dates** (`YYYY-MM-DD`) compared as strings — no time/UTC (avoids
  off-by-one). Numbers parse string → `number | null` (invalid/empty → `null`, never `0`).
- **Hidden fields are never validated** and never contribute to submitted data.

### templateValidation (builder-time)
- `validateTemplate(template): TemplateIssue[]` — distinct from fill-time `validation`.
- Flags per field/condition: missing label (input fields); select with **zero options**; `min > max`
  (length / value / selections / date); `maxFiles < 1`; calc with **no / invalid / calc-typed**
  sources; condition with no target, incomplete value, self-reference, or dangling target; duplicate
  option labels (warning).
- Severity `error` blocks (or hard-warns on) Save; `warning` is surfaced inline but non-blocking.
- Powers the builder issues surface and the Save guard.

### pdf (browser-native)
- `buildPdf(snapshot, effectiveValues, visibleFieldIds, submittedAt): Blob`
- PDF 1.7; base-14 Helvetica/Helvetica-Bold (no embedding). Tracks object byte offsets for xref.
- Title, submission timestamp, visible fields in form order, section headers as sized headings.
- Text escaping (`(`, `)`, `\`), wrap by Helvetica glyph widths, paginate at bottom margin.
- File fields render as `📎 name · type · size` + "(file content not included in this export)".
- Hidden fields excluded entirely. **PDF is generated on demand — never stored in localStorage.**
- Export `visibleFieldIds` are **recomputed** by running `conditionEngine` over the instance's
  `templateSnapshot.fields` + stored `values` — so re-download is deterministic and reflects the
  form exactly as submitted, even after the live template is edited or deleted.

---

## 5. Edge-Case Catalog (each is a named, tested behavior)

**Conditional logic**
- Hidden field never validated as required, even if marked required.
- Hidden field value excluded from submission, PDF, downstream conditions, and calculations.
- Chained A→B→C resolves to a stable fixpoint; hiding B removes B's value from C's condition.
- Self-reference forbidden (UI) and ignored (eval).
- Cycles detected ⇒ deterministic fallback to defaults + builder warning.
- Dangling reference (deleted target) ⇒ condition inert; builder flags it.
- Multiple conditions ⇒ last-match-wins per axis (documented).

**Calculation**
- Source deleted/hidden/empty ⇒ excluded from set.
- `avg/min/max` of empty set ⇒ blank, not `0`/`NaN`.
- Calc-sources-calc blocked in UI and at eval.
- Rounding applied to result only.

**Validation / fill**
- Min/max length, value, selections; file count + accepted-type; date bounds.
- `decimals` clamps number precision; empty/invalid number ⇒ `null`, never `0`.
- Date prefill-today sets value only on *new instance open*; never overwrites an existing value.
- Dates are local calendar dates compared as strings; "today" is local-time; tests mock `Date`.
- File type match is case-insensitive (extension or MIME glob); re-opened instances show metadata
  only — the original File object cannot be re-materialized.
- Required multi-select ⇒ at least one selection (or `minSelections` if higher).

**Persistence / lifecycle**
- Full page refresh restores the current screen (URL route) AND in-progress edits (autosaved drafts).
- Builder draft vs committed template; Fill draft cleared on submit; submitted instances immutable.
- **Autosave** is debounced AND **flushed on `blur` / `visibilitychange` / `pagehide`**, so the
  debounce tail is never lost when a tab is closed or backgrounded; a status pill shows
  `editing → saving → saved` / `save failed`.
- **`QuotaExceededError` / storage-unavailable**: writes return a typed `StorageResult` (never throw);
  on failure autosave **freezes**, the in-memory draft is kept, and a **recovery dialog** offers
  Export-as-JSON + reclaim-space guidance + Retry. A failed Submit keeps the fill draft intact. A boot
  `probeStorage()` warns when storage is unavailable (private mode). No silent data loss, no crash.
- Schema migration runs on read when `schemaVersion` is behind.
- Editing/deleting a template does not corrupt existing instances (snapshot isolation).

**Referential integrity (builder edits)**
- Deleting a field that is a **condition target** or **calc source** ⇒ warn and list dependents;
  on confirm, dependents' conditions go inert (dangling, flagged) and calc `sourceFieldIds` drop the ID.
- Deleting a **select option** referenced by a condition value ⇒ the stale option ID never matches
  (inert); builder flags it.
- Deleting a **template** ⇒ **safe-reversible cascade**: a confirmation dialog naming the exact
  consequence ("…and its **N** responses — can't be undone"), then cascade-delete the instances, then
  a ~6s **Undo** toast backed by a temporary `fb:trash` snapshot (template + instances) that is purged
  only if Undo is not clicked. Avoids both silent data loss and orphaned-instance clutter.
- Reordering never changes IDs ⇒ no reference can break on reorder.

**Drag-and-drop (builder)**
- Reorder mutates array order only; **stable field IDs untouched** ⇒ conditions/calculations never break.
- Field order is presentational; logic is order-independent (no "can't move above dependency" rule).
- `Esc` mid-drag restores original order; drop outside a valid zone is a no-op.
- Selected-field (config panel) state preserved across a reorder.
- Activation constraint prevents a tap/click from starting an accidental drag.
- Every reorder is achievable via keyboard and via up/down buttons, not only by mouse.

**Best practices**
- TS `strict`, no `any`, `assertNever` on every field-type / action switch. IDs via `crypto.randomUUID()`.
- Accessible inputs: real `<label>`s, `aria-invalid`, keyboard nav for radio/tiles/dropdown,
  focus trap + restore in modals.
- On failed submit: render an `aria-live` **error summary**, focus the **first invalid field**, and
  link each error via `aria-describedby`.
- No `dangerouslySetInnerHTML`; React escapes user text in the UI and the PDF writer escapes it for
  the byte stream. localStorage holds only the user's own data.
- Error boundaries around Builder/Fill so one bad config can't white-screen the app.

---

## 6. Testing Strategy

**Unit (Vitest)** — pure engines + reducers, exhaustive:
- conditionEngine: every operator per type; chained; hidden-value exclusion; self-ref; cycles; multi-condition precedence.
- calculationEngine: each aggregation; empty/hidden/deleted sources; decimals; calc-source-calc rejection.
- validation: each rule + hidden-required skip; file-type match; date string-compare; number parsing.
- templateValidation: missing label, empty options, min>max, invalid/calc sources, bad conditions.
- repository: CRUD; v0→v1 migration; `StorageResult` mapping (`quota` / `unavailable` / `unknown`);
  `probeStorage()` against a throwing storage stub.
- drafts: builder/fill draft autosave + restore + clear-on-submit/commit (mocked storage).
- autosave controller: debounce coalescing, flush on `blur`/`visibilitychange`/`pagehide`,
  freeze-on-failure + Retry re-arm, status transitions (fake timers + mocked storage).
- pdf: valid byte output; escaping; pagination; hidden-field exclusion; file-metadata note.
- reducers: Builder/Fill action coverage incl. `assertNever` default.
- reorder/insert: `moveItem` and `insertField` pure functions (boundaries, no-op, identity moves).
- Component round-trip per field (Testing Library): ConfigEditor ⇄ FillRenderer.
- Coverage gate: 100% on `src/domain` engines (condition / calc / validation / templateValidation), enforced in CI.

**E2E (Playwright)** — user-visible guarantees:
- Build template with all 9 types, configure, reorder, save → **refresh persists**. Drive reorder
  via the **deterministic paths** (keyboard drag + up/down buttons) for reliable assertions; cover
  mouse-drag with explicit pointer steps. (Reorder *logic* is already proven by the pure-fn tests.)
- Fill per type incl. validation errors blocking submit.
- Conditional logic real-time show/hide; hidden-required does not block submit; chained.
- Calculation updates live as sources change.
- Submit → instance saved → **PDF downloads** (assert download + `%PDF` header + hidden labels absent).
- Instances list + **re-download** after the template is edited (snapshot integrity).
- Refresh durability: refresh mid-builder-edit and mid-fill restores the route + entered data.
- Autosave: edit → status pill reaches `saved`; reload restores; closing the tab (`pagehide`) flushes
  the last unsaved keystrokes (assert via reload after dispatching the event).
- Storage failure: with `localStorage.setItem` stubbed to throw quota, autosave shows `save failed`,
  the **recovery dialog** appears with a working **Export-as-JSON** download, the draft survives, and a
  Submit under quota keeps the completed response on screen (submit-failure safety net).
- Boot probe: with storage stubbed unavailable, the private-mode banner is shown.
- A11y assertions on hand-built primitives (keyboard, aria, focus); submit error-summary + focus-first-invalid.
- Practices: seed localStorage via `addInitScript`, **mock `Date`** for deterministic today/timestamps, Page Object Model + test-data builders, run against the built app in CI.

---

## 7. Shared Context Preamble (prepend to EVERY phase prompt)

> **Project: Form Builder.** A browser-based form builder (Google-Forms-like, modern-SaaS
> quality). Two modes — **Builder** (design a template) and **Fill** (instance a template, fill,
> export PDF). **React 18 + TypeScript (`strict`, no `any`), Vite, Tailwind-only, localStorage
> only (no backend), no third-party PDF libraries.** State is **React Context + `useReducer`**
> (separate Builder and Fill contexts). Persistence is a **pure repository layer over partitioned
> localStorage** with `schemaVersion` + migrations.
>
> **9 field types**: singleLineText, multiLineText, number, date, singleSelect, multiSelect,
> fileUpload, sectionHeader, calculation. **Conditional logic is a property on every field**, not
> a type. **Calculation** fields compute from Number fields.
>
> **Non-negotiable architecture**: a pure engine layer (no React) — `conditionEngine` (fixpoint
> resolver + cycle detection), `calculationEngine` (dependency-driven), `validation`, `pdf/`
> (hand-rolled browser-native byte writer) — plus a **Field Registry**
> (`Record<FieldType, FieldDefinition>`) so an 11th type is one new file + one registry entry.
> Snapshot the template into each instance so PDFs re-export faithfully after edits/deletes.
> Hidden fields are never validated, never exported, and never feed conditions or calculations.
> The PDF is generated on demand and is **never** stored in localStorage. Refresh durability comes
> from URL routing + debounced **draft autosave** (builder & fill, flushed on tab-hide); submitted
> instances are immutable snapshots. Every storage write returns a typed `StorageResult`; quota /
> storage-unavailable failures freeze autosave and surface a **recovery dialog** (Export-as-JSON),
> never a crash or silent data loss. A separate `templateValidation` guards Save at build time.
>
> Prioritize edge-case correctness, scalability within browser limits, accessibility, type safety,
> and test coverage. The full schema (§3), engine contracts (§4), and edge-case catalog (§5) of
> PHASED_PROMPTS.md are the authority — follow them exactly.

---

## 8. Phase Prompts

> Each prompt = Shared Context Preamble (§7) + the phase block below. Phases are dependency-ordered.
> Do not begin a phase until the prior phase's acceptance criteria are green.

### Phase 1 — Scaffold & Types
**Task.** Initialize Vite + React + TS (`strict`) with ESLint, Prettier, Tailwind, Vitest, and
Playwright. Implement the complete domain schema from §3 verbatim (the mapped discriminated
union, Condition, Template, TemplateSnapshot, FormInstance). Add an `assertNever(x: never)` util.
Establish the folder layout: `src/domain` (types + engines), `src/registry`, `src/persistence`,
`src/state`, `src/ui`, `src/pdf`, `tests/`. Set up **client routing** (routes per §2 "Routing &
refresh durability") so a refresh on any URL re-mounts the correct screen.
**Constraints.** No UI features yet. No `any`. Tailwind configured with a small design-token theme.
**Acceptance.** `tsc --noEmit` + ESLint clean; one passing Vitest test; Playwright smoke test boots
the dev server and sees the app shell.

### Phase 2 — Persistence Layer
**Task.** Build the pure repository over partitioned localStorage keys
(`fb:templates:index`, `fb:template:<id>`, `fb:instances:<templateId>`, drafts
`fb:draft:template:<id>` and `fb:draft:instance:<id>`, plus `fb:trash` for reversible deletes).
Implement CRUD for templates and instances, draft save/load/clear, trash put/restore/purge, a
`schemaVersion` field, and a migration runner that upgrades records on read. **Writes never throw to
the UI**: wrap every write and return a typed `StorageResult<T>` (`ok` | `quota` | `unavailable` |
`unknown`), catching `QuotaExceededError` and Safari's legacy `QUOTA_EXCEEDED_ERR` (§2 "Autosave &
storage-failure handling"). Provide `probeStorage(): 'writable' | 'unavailable'` for a boot-time
writability check (private mode / blocked storage / sandboxed iframe). Also implement the **pure core
of the autosave controller** (debounce + coalesce + freeze-on-failure state machine) here so it is
unit-testable without React.
**Constraints.** Framework-agnostic (no React imports). Storage access behind a thin adapter so it
can be mocked.
**Acceptance.** Unit tests: CRUD round-trips; a v0→v1 migration; `StorageResult` maps
quota/unavailable/unknown correctly; `probeStorage()` returns `'unavailable'` against a throwing
storage stub; autosave core debounces/coalesces and freezes on a failed write; partition keys
verified (saving one template doesn't rewrite others).

### Phase 3 — Pure Engines + Tests
**Task.** Implement `conditionEngine`, `calculationEngine`, and `validation` exactly per §4, with
the edge behaviors in §5. No React.
**Constraints.** Pure functions; deterministic; cycle-safe; hidden-aware.
**Acceptance.** Full unit matrix from §6 passes — including chained conditions, hidden-value
exclusion, cycle fallback, multi-condition last-match-wins, empty-set calc ⇒ blank, and
calc-source-calc rejection.

### Phase 4 — Field Registry
**Task.** Define `FieldDefinition<T>` (§2) and implement all 9 definitions, each in its own file
under `src/registry/fields/`, registered in one `registry` map. Each provides defaultConfig,
emptyValue, ConfigEditor, FillRenderer, validate (delegating to §4), toPdfRows, conditionOperators,
and evaluateCondition. Implement the singleSelect `radio | dropdown | tiles` display variants with
**identical** selection + required behavior. Build the hand-rolled accessible **Radio/Tiles group**
and **Dropdown** primitives here, plus the shared **`<SortableList>`** abstraction (dnd-kit) and the
pure `moveItem`/`insertField` reducers. Wire the Single/Multi Select ConfigEditors' **options
reorder** (surface #3) through `<SortableList>` with a grip handle + up/down fallback.
**Constraints.** No `switch (field.type)` outside the registry. A11y: labels, `aria`, keyboard nav.
**Acceptance.** Component round-trip tests per field; pure-fn tests for `moveItem`/`insertField`;
a test proving a stub `phone` type wires into palette/config/fill/PDF/operators with **no edits to
existing files**.

### Phase 5 — Builder Mode
**Task.** Three-panel builder: left palette, center canvas, right config panel (registry-driven).
Implement the drag-and-drop per §2 "Drag-and-drop design": surface #1 palette→canvas (click =
append, drag = insert at position via `<SortableList>` cross-container), surface #2 canvas reorder
(grip handle, drag overlay, insertion line, autoscroll, activation constraint, keyboard drag, and
always-visible up/down buttons), empty-canvas dropzone placeholder, `Esc`-cancel, selection
preserved across reorder. All reorders dispatch the pure `moveItem`/`insertField` reducers; stable
IDs untouched. Conditional-logic editor (target/operator/value/effect; self-ref blocked;
dangling-ref flagged; operators filtered by target type; **value editor adapts per operator/target
type** per §3). Calculation source picker (Number fields only; calc sources disallowed). Inline
editable **template title** (defaults to "Untitled form"). **Draft autosave** to
`fb:draft:template:<id>` via the **autosave controller** (§2): debounced, **flushed on
`blur`/`visibilitychange`/`pagehide`**, surfacing a status pill (`editing → saving → saved` /
`save failed`). Build the shared **`AutosaveStatus`** pill and **`QuotaRecoveryDialog`** components
here (reused by Fill): on a `quota`/`unavailable` `StorageResult` the dialog appears (Export-as-JSON +
reclaim-space + Retry) and autosave freezes until Retry. Show the **storage-unavailable boot banner**
when `probeStorage()` is `'unavailable'`. Explicit **Save** commits to the template (guarded by
`templateValidation` errors, surfaced inline); **Discard changes** reverts to the last saved version.
Deleting a field/option warns about dependents per §5 referential integrity. Inline/modal Preview
using the hand-built Modal.
**Constraints.** Order is presentational only — never gate reordering on conditional dependencies.
**Acceptance.** E2E: build all 9 types, configure, **reorder via keyboard and via up/down buttons**,
save, **refresh → state persists**; the autosave pill reaches `saved` and a `pagehide` flush persists
the last keystrokes; with storage stubbed to throw quota the pill shows `save failed`, the
`QuotaRecoveryDialog` appears with a working Export-as-JSON, and the draft is not lost; reordering does
not break an existing condition; self-reference and calc-source-calc are not selectable.

### Phase 6 — Fill Mode
**Task.** Render fields via the registry. Wire real-time conditional visibility/required and live
calculations through the engines (§4). Apply date prefill-today only on new-instance open. **Autosave
entered values** to `fb:draft:instance:<id>` via the same autosave controller + `AutosaveStatus` pill
(§2): debounced, **flushed on `blur`/`visibilitychange`/`pagehide`**; restore on refresh. Validate on
submit (skip hidden-required); on failure show an `aria-live` **error summary** and focus the **first
invalid field**. On submit, persist an immutable `FormInstance` with `templateSnapshot` and **clear
the draft**. **Submit-failure safety net:** if the `FormInstance` write returns a non-`ok`
`StorageResult` (quota/unavailable), **do not clear the draft** — keep the user on the filled form and
show the shared `QuotaRecoveryDialog`, so a full disk never destroys a completed response.
**Acceptance.** E2E: fill per type; validation blocks submit + focuses first invalid; conditional
show/hide is live; hidden-required does not block; calculation updates live; **refresh mid-fill
restores entered values**; submit creates a stored instance and clears the draft; **a Submit under
simulated quota keeps the draft and shows the recovery dialog** (response not lost).

### Phase 7 — PDF Export
**Task.** Implement the hand-rolled `pdf/` module per §4: PDF 1.7, base-14 fonts, object offsets +
xref + trailer, text escaping, glyph-width wrapping, pagination. Render title, timestamp, ordered
visible fields, section-header heading sizes, and file-metadata note. Download via `Blob` + anchor.
**Constraints.** Browser-native only; no PDF library; PDF never persisted.
**Acceptance.** Unit tests on emitted bytes (valid `%PDF`, escaping, pagination, hidden-field
exclusion, file note); E2E asserts the download fires and the file is a non-empty PDF.

### Phase 8 — Templates & Instances Lists
**Task.** Home templates list — cards show title, field count, instance count, last-modified;
"New Template" and per-card "New Response"; **clicking a card opens it in Builder (edit)**. Per-template
instances list — submission timestamp + "Re-download PDF" (regenerates from snapshot). Destructive
actions use the §5 **safe-reversible cascade**: a confirmation dialog naming the response count,
cascade-delete, then a ~6s **Undo** toast (temporary `fb:trash`, purged if not restored). Virtualize
long lists past a documented threshold.
**Acceptance.** E2E: create → respond → list → **re-download after editing the template** (snapshot
integrity holds); delete template removes its instances after a count-named confirm, and **Undo
restores** template + instances within the window.

### Phase 9 — Hardening & CI
**Task.** Error boundaries around Builder/Fill. Accessibility pass (labels/aria/keyboard for tiles,
dropdown, modal focus trap + restore). README documenting all §5 edge-case decisions + the
conditional-logic AND/OR (last-match-wins) rule + the localStorage/PDF storage rationale. GitHub
Actions running typecheck + lint + unit + Playwright against the built app.
**Acceptance.** Green CI; README complete; no `any`; all prior-phase E2E still pass.

---

## 9. Open Items / Parking Lot

- Threshold for list virtualization (instances + long option sets) — decide during Phase 8.
- IndexedDB migration path if localStorage quota becomes a real constraint (documented, not built).
- Whether to expose a builder-side "lint" panel summarizing dangling refs / cycles / unreachable
  fields (nice-to-have, candidate for a future revision).
- Duplicate-field / duplicate-template actions (nice-to-have).
