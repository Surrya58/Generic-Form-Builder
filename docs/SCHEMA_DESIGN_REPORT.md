# Form Builder — Schema Design Report: Templates, Responses & Autosave

## Executive summary

The Form Builder is a browser-only application — React 18 + TypeScript (`strict`, no `any`), Tailwind, **localStorage as the sole store, no backend** — with two modes: **Builder** designs a reusable `Template`, and **Fill** instances a template, captures a `FormInstance`, and exports a hand-rolled PDF on demand. The data design is built around four decisions that everything else follows from:

1. **Snapshot, don't reference.** Each submitted `FormInstance` embeds a frozen `TemplateSnapshot`, so a response — and any PDF re-exported from it — stays faithful forever, even after the live template is edited or deleted.
2. **Three record kinds, cleanly separated.** A mutable, autosaved `Draft` is structurally distinct from both the committed `Template` and the write-once-immutable `FormInstance`. This makes refresh durability and immutability simultaneously true.
3. **Partitioned localStorage, not a monolithic blob.** One key per record (plus a lightweight index) keeps debounced autosave cheap (one key per write), keeps the home list fast, and makes reversible cascade-delete tractable.
4. **Types communicate design.** A mapped discriminated union for `Field`, a typed `StorageResult<T>` that never throws, per-record `schemaVersion` migrated on read, and stable `crypto.randomUUID` join keys make illegal states unrepresentable and force the compiler to police extensibility.

A fifth, quieter decision threads throughout: temporal data is split at the type level into **machine timestamps** (`ISODateTime`, UTC) and **calendar date values** (`ISODate`, local, string-compared) — the structural defense against timezone off-by-one bugs.

This report documents each schema choice with its rationale for *this* product, the alternatives rejected, the exact type definitions, the edge cases it must handle, and how it is tested.

---

## Data model at a glance

There are exactly three persisted record kinds — `Template`, `FormInstance`, and `Draft` — plus a derived index. Their cardinality is the load-bearing design fact: **one `Template` → many `FormInstance`s**, with `Draft` a **1:1 mutable sidecar** for whichever record is currently being edited.

### ER-style overview

```
            1                              N
 ┌───────────────────┐  templateId   ┌──────────────────────────┐
 │     Template      │◄──────────────│      FormInstance         │
 │───────────────────│  (soft FK,    │──────────────────────────│
 │ id            (PK)│   grouping +   │ id                  (PK) │
 │ schemaVersion     │   cascade)     │ templateId          (FK) │
 │ title             │                │ templateSnapshot {       │ ← HARD, self-contained
 │ fields[]  (order  │                │   title, fields[],       │   ref; all engines read
 │   = render order) │                │   schemaVersion }        │   THIS, never the parent
 │ createdAt         │                │ values{ fieldId → val }  │ ← keys → snapshot.fields
 │ updatedAt         │                │ submittedAt              │
 └─────────┬─────────┘                └──────────────────────────┘
           │ 0..1 (while editing)
           ▼
 ┌───────────────────┐        ┌───────────────────┐
 │  Draft (template) │        │  Draft (instance) │  0..1 while filling
 │  kind:'template'  │        │  kind:'instance'  │
 │  refId → tmpl id  │        │  refId → inst id  │
 │  payload (partial)│        │  payload (partial │
 │  updatedAt        │        │    values)        │
 └───────────────────┘        └───────────────────┘

 Within a Template/Snapshot:  Field.id ─┬─◄ Condition.targetFieldId    (inert if dangling)
                                        └─◄ calculation.sourceFieldIds  (dropped/excluded if deleted)
                              Option.id ──◄ Condition.value (option ids; inert if stale)
```

There are **two** foreign keys inside `FormInstance`: `templateId` is a *soft/provenance* FK (grouping and cascade only — it may dangle), while `values` is keyed by `fieldId` against the fields **inside that instance's own `templateSnapshot.fields`** — the *hard* reference everything reads. That asymmetry is the whole point of snapshot isolation (detailed below).

### Storage-key map

All persistence sits behind a pure repository over **partitioned keys** (§1, §2):

| Key | Holds | Cardinality |
|---|---|---|
| `fb:templates:index` | lightweight list of template summaries (id, title, counts, `updatedAt`) for the home list | 1 |
| `fb:template:<id>` | one full `Template` record | N (one per template) |
| `fb:instances:<templateId>` | the array of `FormInstance`s for that template | N (one bucket per template) |
| `fb:draft:template:<id>` | the in-progress builder `Draft` (payload = partial `Template`) | 0..1 per open template |
| `fb:draft:instance:<id>` | the in-progress fill `Draft` (payload = partial `values`) | 0..1 per open instance |
| `fb:trash` | temporary cascade-delete snapshot for ~6 s Undo | 0..1 |

### The full schema (the contracts)

```ts
type ISODate = string;       // 'YYYY-MM-DD'  — a local calendar date, no time, no zone
type ISODateTime = string;   // ISO 8601      — an instant in time (UTC)

// 9 field types; conditional logic is a property, not a type.
type FieldType =
  | 'singleLineText' | 'multiLineText' | 'number' | 'date'
  | 'singleSelect'   | 'multiSelect'   | 'fileUpload'
  | 'sectionHeader'  | 'calculation';

interface Option   { id: string; label: string; }
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
  targetFieldId: string;             // stable UUID; must differ from the owning field
  operator: Operator;                // constrained by the target field's type
  value: ConditionValue;
  effect: 'show' | 'hide' | 'require' | 'unrequire';
}

interface Template {
  id: string;
  schemaVersion: number;             // for migrations
  title: string;                     // never empty; defaults to "Untitled form"
  fields: Field[];                   // array order = render order (presentational only)
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// Snapshot the template into each instance so PDFs re-export faithfully after edits/deletes.
interface TemplateSnapshot {
  title: string;
  fields: Field[];                   // full field defs: config, conditions, defaultVisibility/Required
  schemaVersion: number;             // the version the values were captured under
}

interface FormInstance {
  id: string;                                  // crypto.randomUUID()
  templateId: string;                          // provenance link only — never read for rendering
  templateSnapshot: TemplateSnapshot;          // the authoritative, frozen definition
  values: Record<string /*fieldId*/, unknown>; // validated against snapshot on read
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

// Storage boundary — every write returns this; writes never throw to the UI.
type StorageResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: 'quota' | 'unavailable' | 'unknown'; message: string };

// Boot-time writability probe (private mode / blocked storage / sandboxed iframe):
function probeStorage(): 'writable' | 'unavailable';
```

---

## Form Templates

The `Template` is the root design-time aggregate of the Builder. Everything a user creates in Builder Mode — the title, the ordered fields, their per-type config, and all conditional/calc logic — is captured by exactly one `Template` record. It is the thing the templates list indexes, the thing the Builder edits as a draft and commits on Save, and the thing that is **snapshotted** (not referenced) into every `FormInstance`.

The six top-level keys are deliberately the *entire* surface of a template: there is no `description`, no `theme`, no per-template settings blob. Anything that varies per field lives inside `Field`; anything global to the document lives in these six fields. Keeping the root small is what makes migration-on-read and the snapshot copy cheap and total.

### `fields[]` order is render order, and presentational only

`fields: Field[]` carries two pieces of information at once: **which** fields exist, and **in what order they render**. There is no separate `order` integer on `FieldBase` and no `position` index — the array *is* the ordering.

**Rationale (for this app).** Builder Mode is fundamentally a reorderable list of cards across three DnD surfaces (§2). Modeling order as array position means the one operation the UI performs constantly — reorder — is a pure array permutation (`moveItem(list, fromId, toIndex)`) rather than a renumber-all-siblings pass. The reducer mutates array order only; **IDs are untouched** (§2, §5).

The load-bearing invariant from §2 is that **order is purely presentational**: conditions and calculations reference fields by **stable ID**, and the `conditionEngine` is **order-independent** (it resolves to a fixpoint, §4). Therefore "reordering can never break logic and needs no ordering constraints" — there is deliberately **no "can't move a field above its dependency" rule** (§5). This is only sound *because* order is array position and references are IDs; if logic referenced fields by index, every reorder would silently rewire conditions. The render layer reads the array top-to-bottom (Builder canvas, Fill form, and the PDF, which emits "visible fields **in form order**", §4); hidden fields are skipped at render/export time, but their *position* in `fields[]` is preserved — visibility is a runtime axis computed by the engine, never a mutation of the array.

**Alternatives rejected.**
- **Explicit `order: number` per field.** Requires keeping the integers dense and unique on every insert/delete/reorder; two fields with a duplicated or stale order index is an unrepresentable-but-creatable bug. Array index is automatically dense, unique, and total.
- **A separate `fieldOrder: string[]` alongside an unordered `fields` map.** Two structures that can disagree (an ID in `fieldOrder` with no field, or vice-versa). It buys O(1) field lookup, but a template's field count is small (a single browser-rendered form), so the linear scan is irrelevant and the second source of truth is pure liability.
- **A linked-list (`nextFieldId`) ordering.** Reorder becomes pointer surgery with cycle risk, and it is far harder to test than a pure array permutation.

### Stable field UUIDs

The ID in `FieldBase.id` is the join key for the entire logic layer. `Condition.targetFieldId`, `FieldConfigMap['calculation'].sourceFieldIds`, and `FormInstance.values` (keyed `Record<string /*fieldId*/, unknown>`) all point at this ID. The comment "survives reorder/rename" states the contract precisely: changing a field's label or moving it in the array must never change its `id`, so no reference can dangle from a benign edit. IDs are generated with `crypto.randomUUID()` (§1, §5) — collision-free without a counter, working offline with no backend. `Option.id` follows the same discipline: condition values for selects store **option IDs**, not labels, so renaming an option label never breaks a condition.

**Alternatives rejected.** *Array index as identity* (catastrophic with reorder — every move rewrites every reference); *label/slug as identity* (labels are user-editable and non-unique — `sectionHeader`'s label *is* its content); *an auto-increment counter* (requires persisting counter state and is fragile across the undo/trash restore path — UUIDs need no shared mutable state).

### Title defaulting

`title` is a non-optional `string`, so the type guarantees a renderable value everywhere a template is listed (list cards, Phase 8) and in the PDF (§4). Rather than allow `title?: string` and force every consumer to handle `undefined`, the model guarantees a value: the inline-editable title **defaults to "Untitled form"** (§2 r3, Phase 5), applied at creation, so a freshly created template is immediately valid and listable.

**Alternatives rejected.** *`title?: string`* pushes a fallback string into every render site (list card, Builder header, PDF writer, snapshot copy) — four places to keep in sync. *Treating an empty title as a blocking `templateValidation` error* is over-strict; the spec reserves blocking `error` severity for genuinely broken structure (missing input-field labels, empty selects, `min > max`, bad calc sources — §4). Note the asymmetry: input-field **labels** are required and validated; the **template title** is defaulted — different fields, different rules.

### `schemaVersion` + migration-on-read

This is a localStorage-only app with **no backend and no migration window** — a returning user simply loads whatever JSON their browser persisted on a possibly-older version of the app. `schemaVersion` is the per-record stamp that lets the repository **migrate on read**: "Schema migration runs on read when `schemaVersion` is behind" (§5), via a "migration runner that upgrades records on read" (Phase 2). The flow is: read raw JSON → if `schemaVersion < current`, run the ordered migrations → hand a current-shape record to the rest of the app. Nothing else in the codebase ever sees an old shape.

Crucially, the stamp lives **on each record** (`Template` *and* `TemplateSnapshot`), not as one global version. With partitioned storage and immutable, independently-aged snapshots, records genuinely migrate at different times — an instance written months ago carries an old-shape `templateSnapshot` while a freshly edited template is current.

**Alternatives rejected.**
- **A single global schema version.** Cannot describe a store where records are at mixed versions; would force an all-or-nothing migration of every key at once (expensive and risky under a possibly-full quota). Per-record versioning lets each record (and each snapshot) upgrade lazily, the first time it is read.
- **No version field; sniff the shape.** Brittle and untestable; sniffing breaks the moment two versions differ only by a default value.
- **Migrate-on-write only.** A record that is only ever *read* (e.g. an old instance you re-download but never edit) would never get migrated, so every reader would still need to handle every historical shape. Migrate-on-**read** centralizes all version-handling in one runner.

**Edge cases.** A stored instance's embedded `TemplateSnapshot.schemaVersion` can itself be behind and must be migrated on read before the `conditionEngine` re-derives `visibleFieldIds` for re-download — the same runner must accept a snapshot, not only a live template. A record whose `schemaVersion` is *ahead* of the running app (user opened an older build) cannot be safely down-migrated — a defined boundary the runner must fail safely on. A migrate-then-write under a full quota must go through the `StorageResult` path so it surfaces the recovery dialog instead of throwing.

### The mapped discriminated union for `Field`

`Template.fields` is typed `Field[]`, and `Field` is **derived**, not hand-written (see the schema above). Each member is `FieldBase & { type: K; config: FieldConfigMap[K] }` — `type` is the discriminant and `config` is automatically the **matching** per-type shape. A `Template` therefore cannot hold a structurally illegal field: you cannot construct `{ type: 'number', config: { options: [...] } }` because `FieldConfigMap['number']` has no `options`. Narrowing on `field.type` in any consumer (registry renderers, validation, PDF) yields the correct `config` and value types with no casts. This is the mechanism behind the locked rule "no `switch (field.type)` scattered across the app" and "an 11th type = ONE new file + ONE registry entry" (§1, §2): adding a key to `FieldConfigMap` regenerates `Field`, and TypeScript then **forces** every `assertNever`-guarded switch and the registry to handle the new member (§5).

`FieldConfigMap` is paralleled by `FieldValueMap`. The *config* union flows into the **template** (shape); the *value* map flows into the **instance** (`FormInstance.values`, validated against the snapshot on read). `FieldBase` carries `defaultVisibility`/`defaultRequired` — the **base states applied before conditions** (per r3 the redundant `required` flag was dropped; the "Required toggle" maps to `defaultRequired`). The template stores only base states; the *effective* visibility/required is computed by the `conditionEngine` at fill time. `sectionHeader` and `calculation` are non-input/read-only — `FieldBase` documents that their defaults are ignored and `FieldValueMap['sectionHeader']` is `never` — but the union still includes them uniformly, so the template models them as ordinary list members; the registry's `isInput` flag and the engines handle their special behavior, not the type.

**Alternatives rejected.** *A single fat `Field` interface with every optional config property* (every consumer needs defensive null-checks, illegal combinations become representable, and adding a type would force *no* consumer to update). *`config: unknown` plus runtime parsing* (throws away the type safety the spec requires, reintroduces `any`-shaped code). *Hand-writing the nine-member union literally* (correct but not single-source-of-truth — the discriminant and config map could drift).

---

## Form Responses (Instances)

A `FormInstance` is the immutable record produced when a user submits a filled-out template. Its defining design decision is that it does **not** reference the live `Template` — it carries a self-contained `TemplateSnapshot` so that the response, and any PDF re-export from it, remains faithful forever.

Note the deliberate asymmetry between `Template.fields: Field[]` and the snapshot: `TemplateSnapshot` reuses the exact `Field` union, so a snapshot is structurally a frozen slice of a template — config, `conditions[]`, `defaultVisibility`, and `defaultRequired` all travel with it. That is precisely what makes a deterministic visibility recompute possible from the instance alone.

### The central decision: snapshot the template into each response

When a user submits, we copy `{ title, fields, schemaVersion }` from the live `Template` into the new `FormInstance.templateSnapshot`. The instance is then **fully self-describing**: it owns every field definition, option, condition, and calculation source it needs to validate its `values`, recompute visibility, and render a PDF — without ever reading the `Template` record again. The relationship is deliberately asymmetric:

- `FormInstance.templateId` is a **soft / provenance FK** — it groups instances under a template for listing and cascade-delete, and may dangle if the template is later removed.
- `FormInstance.templateSnapshot` is the **hard reference** — self-contained, and the only thing validation, condition resolution, calculation, and PDF export ever read for that instance.

**Rationale — why, for this app.**

- **Faithful PDF re-download after edits/deletes.** The PDF is generated on demand and is *never* stored (§1, §4). Re-download re-derives the document from the instance every time, and §4 mandates that the export's `visibleFieldIds` are **recomputed by running `conditionEngine` over the instance's `templateSnapshot.fields` + stored `values`**. If the engine ran over the live template instead, an added/removed/renamed field would silently rewrite a months-old PDF.
- **Immutability / data integrity.** §2 makes submitted instances immutable — "re-download only, never edited." Immutability of `values` is hollow if the labels, options, and structure those values are interpreted against can still move underneath them. The snapshot freezes the entire *interpretation context*, not just the raw answers.
- **Deterministic visibility recompute.** Conditional visibility is not stored per field; it is recomputed (a fixpoint, §4). For that recompute to be reproducible across re-downloads it must run against a fixed `fields` array — the snapshot — so a hidden-on-submit field stays hidden in every future PDF.
- **Snapshot isolation as a correctness invariant.** §5 lists "Editing/deleting a template does not corrupt existing instances (snapshot isolation)" as a named, tested behavior. The snapshot *is* the isolation boundary — there is no shared mutable state between a template and the responses already taken against it.
- **Schema-version pinning.** `schemaVersion` is carried *in the snapshot*, capturing the version the `values` were authored under, so an instance migrates on its own terms (migrate-on-read) rather than being reinterpreted by a drifted live template.

**Cost accepted:** storage duplication — every response re-stores the full field set. A conscious trade in a localStorage-only app: responses are partitioned under `fb:instances:<templateId>`, `fileUpload` stores **metadata only, no bytes**, and the quota path is already hardened (`StorageResult`, recovery dialog, Export-as-JSON). Correctness of historical records is worth more than bytes here. (Because localStorage stores serialized JSON, not object graphs, there is no shared-reference benefit to be had after `JSON.stringify` — a "copy-on-write" alternative would buy nothing and reintroduce live coupling.)

**Alternatives rejected.**
- **Reference by template (store only `templateId` + `values`).** Smallest footprint, single source of truth — but editing or deleting the template retroactively mutates or destroys past responses, violating the "edits/deletes don't corrupt instances" guarantee and breaking deterministic re-download. `templateId` is *retained* purely as a provenance/grouping link, never as rendering truth.
- **Reference by version (`templateId` + `templateVersion`, with a version-history store).** Preserves history while deduplicating, but imposes an append-only versioned template store and a resolver that joins instance → version → fields on every read — substantial machinery for a no-backend app whose state model is partitioned single-record storage with migrations. The snapshot achieves the same "frozen definition" guarantee with zero join logic and no second store to keep consistent. Versioning is explicitly a future-only parking-lot concern.
- **Store rendered HTML (or the pre-built PDF) at submit.** Trivially faithful, but rejected on two locked decisions: the PDF is generated on demand and **never stored** (§1, §4, §7), and the renderer must remain the single hand-rolled byte writer driven by the registry. A frozen blob can't be re-derived in a different paper size, can't have escaping/pagination bugs fixed retroactively, and bloats quota far more than structured data. Keeping `values` + `snapshot` structured means the *same* `pdf.buildPdf(snapshot, effectiveValues, visibleFieldIds, submittedAt)` path produces the document deterministically and improves over time.

### `values` semantics, hidden-field exclusion, and lifecycle

**`values` is keyed by `fieldId`.** Each entry conforms to `FieldValueMap[type]` for the field of that ID in the snapshot. It is typed `unknown` at the boundary deliberately — values arrive from JSON and are **validated against the snapshot on read**, narrowing per the snapshot's field type rather than trusting persisted shape. Keying by stable UUID (not label or array index) is what lets reorder and rename be non-events for stored data — a reordered or relabeled template field still maps to the same answer.

**Hidden fields are excluded from submitted data.** Per §4 and §5, "Hidden fields are never validated and never contribute to submitted data." At submit, the Fill reducer runs `conditionEngine.resolve` over the live fields + entered values; any field resolving to `visible: false` is **omitted from `values`**. The snapshot still contains the field definition, so on re-download the engine re-derives the same hidden state from the same definition + values and the PDF excludes it identically (§4: "Hidden fields excluded entirely"). This is why visibility is *recomputed*, not stored — the snapshot + values are sufficient and self-consistent.

**Draft → submitted lifecycle (one-way, immutable terminus):**

1. **Draft (mutable).** While filling, entered values autosave (debounced, flushed on `blur`/`visibilitychange`/`pagehide`) to `fb:draft:instance:<id>` as a `Draft`. Refresh mid-fill restores the values; conditional/calc state is recomputed from them — no derived state is persisted.
2. **Submit → `FormInstance`.** On Submit, validation runs (skipping hidden-required), and on success an **immutable** `FormInstance` is written with its `templateSnapshot` and the hidden-pruned `values`; `submittedAt` is stamped; the draft is **cleared**.
3. **Submit-failure safety net.** If the `FormInstance` write returns a non-`ok` `StorageResult` (quota/unavailable), the draft is **not** cleared — the user stays on the filled form with the `QuotaRecoveryDialog`. A full disk can never destroy a completed response.
4. **After submit.** The instance is read-only; "New Response" always begins a *fresh* draft against a new `instanceId`. There is no edit path back into an instance.

**Edge cases this schema must handle.**
- **Template edited after submit** (field added, removed, relabeled, reconfigured, condition changed). The instance is untouched because rendering and recompute read `templateSnapshot`, never the live template. A field added after submission simply does not exist in the snapshot, so it never appears in this response's PDF.
- **Template deleted after submit.** Re-download still works — the instance is self-contained. Deletion is the §5 safe-reversible cascade (detailed below); a restored instance is byte-for-byte renderable again.
- **Stale option IDs in `values`.** A `singleSelect`/`multiSelect` value holds option IDs. Because the snapshot freezes the `options[]` as they were at submit, the stored IDs always resolve to their original labels in the snapshot — independent of later edits to the live template. (The *builder* side separately treats a condition value referencing a now-deleted option as inert/flagged; see Relationships below.)
- **Calculation values.** `calculation` stores a *computed snapshot* (`number | null`). The snapshot preserves the calc field's definition and `sourceFieldIds`, and the empty-set rule (`avg/min/max` of nothing ⇒ `null`, never `0`/`NaN`) is reproduced on recompute.
- **Hidden-required at submit.** A field marked required but resolving hidden does **not** block submit and is excluded from `values` — and stays excluded on every future recompute.
- **File fields.** `values` holds `FileMeta[]` (name/size/type) only; the original `File` cannot be re-materialized. The PDF renders the metadata note "(file content not included in this export)." Snapshot faithfulness extends to *what was recorded*, not the bytes — which were never stored.

---

## Timestamps & temporal data

Every piece of *temporal* data draws a hard line between **machine timestamps** (when something happened, system-clock-driven, ISO 8601 UTC) and **date field values** (a human-entered calendar date, no clock involved). Conflating the two is the single most common source of off-by-one and timezone bugs in form apps, and the schema separates them at the type level with `ISODateTime` vs `ISODate`. They are both `string` to the compiler, so the distinction is *documentary, not enforced* by TypeScript alone — a deliberate, accepted trade-off (see "Alternatives" below). The discipline is enforced instead by **where each alias is used** and by the engines/tests that consume them.

| Field | Type | Meaning |
|---|---|---|
| `Template.createdAt` | `ISODateTime` | instant the template record was first written |
| `Template.updatedAt` | `ISODateTime` | instant the template was last committed (explicit Save) |
| `FormInstance.submittedAt` | `ISODateTime` | instant the response was submitted (immutable) |
| `Draft.updatedAt` | `ISODateTime` | instant the autosave controller last flushed this draft |
| `FieldValueMap['date']` | `ISODate \| null` | a user's chosen calendar date — **not** a timestamp |
| `FieldConfigMap['date'].minDate` / `.maxDate` | `ISODate?` | builder-set calendar bounds |

The first four rows are **timestamps** and obey the rules below; the last two are **date field values** and obey the fill-time `validation` rules (§4). They never mix.

### Machine timestamps — `createdAt`, `updatedAt`, `submittedAt`, `Draft.updatedAt`

**Storage format & zone.** All four are stored as **ISO 8601 UTC strings** — the output of `new Date().toISOString()`, e.g. `"2026-06-14T09:41:07.812Z"`. The trailing `Z` is load-bearing: it pins the value to UTC so it is unambiguous regardless of the machine that wrote it or reads it back.

**Rationale (for this app specifically):**
- **localStorage is plain string KV.** There is no `Date` column type; `toISOString()` is the only `Date` serialization that is lexicographically sortable, locale-independent, and round-trippable via `new Date(s)`.
- **Refresh durability.** A UTC ISO string parses back to the identical instant every time, on any machine — no implicit local-zone reinterpretation on rehydrate.
- **Sorting is free.** ISO 8601 UTC strings sort identically as strings and as instants, so the templates/instances lists order by raw string compare with no `Date` parsing.
- **PDF faithfulness.** `buildPdf(..., submittedAt)` prints the submission time. Storing the canonical instant and formatting only at render time means a re-download years later still shows the correct moment.

**When each is written.** `createdAt` — once, at template creation; never mutated. `updatedAt` — bumped on every **explicit Save** that commits the builder draft to the canonical `Template` record; *not* on every autosave keystroke (autosave writes the *draft's* `updatedAt`). `Draft.updatedAt` — written by the autosave controller on each flush; this is what the status pill renders as `saved · <relative time>`. `submittedAt` — once, when Submit successfully persists the immutable `FormInstance`; never touched again.

**Display: relative + absolute.** A single pure formatter serves both registers and takes the reference "now" as an argument rather than reading the clock internally:

```ts
// pure: 'now' is injected, never read from the clock inside
function formatRelative(iso: ISODateTime, now: Date): string;   // "2 minutes ago"
function formatAbsolute(iso: ISODateTime): string;              // locale + LOCAL zone for display
```

**Relative** ("2 minutes ago") is used where recency is the point (the autosave pill, the templates-list "last-modified" line). **Absolute** (locale-formatted local date+time, via `Intl.DateTimeFormat`) is used where the exact moment matters and may be referenced later (the PDF submission timestamp, the per-instance row, and the tooltip of any relative label). Absolute display is the one deliberate place we convert *out* of UTC: a user in `America/New_York` who submits at `14:41Z` should see "10:41 AM". Storage stays UTC; only presentation localizes.

### Date field VALUES — a different kind of temporal data

A `date` field's stored value is **not** a timestamp; it is a **local calendar date** the user picked: `date: ISODate | null` (`'YYYY-MM-DD'`). §4 and §5 are explicit and non-negotiable about three rules:

1. **String, never `Date`.** The value is the raw `YYYY-MM-DD` string straight from `<input type="date">`. It is never parsed into a `Date` for storage or comparison.
2. **Compared as strings.** Min/max bounds and the `isBefore`/`isAfter`/`equals` operators are evaluated by **lexicographic string comparison**:

   ```ts
   // validation: date bounds, string-compared — NO Date construction
   if (config.minDate && value < config.minDate) return error('dateBeforeMin');
   if (config.maxDate && value > config.maxDate) return error('dateAfterMax');

   // conditionEngine date operators (target type = date):
   //   isBefore  → fieldValue <  compareValue
   //   isAfter   → fieldValue >  compareValue
   //   equals    → fieldValue === compareValue
   ```

   This works precisely **because** `YYYY-MM-DD` is fixed-width and zero-padded, so byte order equals chronological order.

3. **No time, no UTC, no off-by-one.** The infamous bug — `new Date('2026-06-14')` is parsed by JS as **midnight UTC**, which in any negative-offset zone renders as `2026-06-13` — is *structurally impossible here* because we never call `new Date()` on a date value. §4: *"Dates are local calendar dates (`YYYY-MM-DD`) compared as strings — no time/UTC (avoids off-by-one)."*

**The "prefill today" rule.** `FieldConfigMap['date'].prefillToday: boolean` seeds the field with today's date, with tightly scoped semantics (§5: *"Date prefill-today sets value only on new instance open; never overwrites an existing value."*). Three things make this correct:

- **Trigger boundary.** "Today" is computed **once, at the moment a fresh fill draft is created** — not on every render, not on refresh of an existing draft. A refresh that rehydrates an in-progress draft keeps whatever the user already had; prefill does not re-fire.
- **"Today" is LOCAL.** Unlike every machine timestamp (UTC), prefill-today must be the user's **local** calendar date — a user filling at 11 PM on June 14 local time expects "June 14", even if it is already June 15 in UTC. So prefill derives `YYYY-MM-DD` from the **local** date parts, not from `toISOString()`:

  ```ts
  // local 'today' as YYYY-MM-DD — NOT new Date().toISOString().slice(0,10)
  function todayLocalISODate(now: Date): ISODate {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  ```

- **Non-destructive.** Prefill seeds only when the value is absent; it never clobbers a user edit or a restored draft value.

This gives a clean rule of thumb: **timestamps are UTC, date values (incl. "today") are local.**

### Sorting & ordering by timestamp

Because timestamps are ISO 8601 UTC strings, the lists order by raw string compare with no `Date` parsing in the hot path:

```ts
// Most-recently-updated templates first — raw string compare, descending.
templates.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
// Instances newest-submitted first.
instances.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0));
```

**Tie-break.** Two records can share a timestamp string (two responses submitted in the same millisecond, or sub-ms truncation). The comparator returns `0` for ties; the list then falls back to a **stable secondary key — the record `id`** (a `crypto.randomUUID`) — so ordering is deterministic and does not flicker between renders.

### Why ISO 8601 UTC strings — alternatives considered

| Alternative | Why rejected for this app |
|---|---|
| **Epoch number (`Date.now()` ms)** | Sorts fine and is compact, but opaque in the localStorage inspector and forces a parse-to-format step everywhere. ISO strings are human-readable in DevTools (a real debugging affordance for a localStorage-only app) and equally sortable. |
| **Store `Date` objects** | Impossible — `JSON.stringify(new Date())` already produces an ISO string and `JSON.parse` gives it back as a string. Pretending otherwise invites `value.getTime is not a function` crashes on rehydrate. |
| **Local-time ISO without `Z`** | Ambiguous: the same string means different instants in different zones, breaking re-download faithfulness and cross-machine sorting. UTC `Z` removes the ambiguity. |
| **Branded types** (`type ISODateTime = string & { __brand: 'dt' }`) | Tempting under `strict` mode — would make `ISODate`/`ISODateTime` mix-ups a compile error. Rejected as over-engineering for the locked schema: requires brand-casting at every boundary (storage reads, `<input>` values, PDF). Separation is enforced by usage discipline + tests instead. *(Flagged as a candidate hardening if mix-ups ever surface.)* |
| **Storing date field values as full ISO datetimes** | The off-by-one trap. A calendar date has no time and no zone; attaching either (`T00:00:00Z`) reintroduces exactly the bug §4/§5 forbid. `ISODate` deliberately carries *less* information than `ISODateTime`. |

### Determinism — never read the clock in pure code

The engine layer is **PURE, no React, 100% unit-tested** (§2, §6), and purity requires determinism — the system clock is the single biggest enemy of deterministic tests. **Rule: no pure function reads the clock.** `conditionEngine`, `calculationEngine`, and `validation` never call `Date.now()` or `new Date()` internally. The two places that legitimately need "now" — the **autosave controller** stamping `Draft.updatedAt`, and **prefill-today** seeding a new fill draft — receive the clock as an **injected argument** (`now: Date`, or a `() => Date` clock), never the ambient global.

**Why, for this app.** A condition like `isBefore today` must give the **same result in a test as in production for a given input**. If `new Date()` were called inside the engine, the test outcome would depend on the wall clock at CI time — flaky by construction. Injecting the clock means the date logic is a pure function of `(fields, values)` (plus an explicit `now` where relevant), which is exactly what the §6 unit matrix asserts. **How tests pin time:** §5 (*"'today' is local-time; tests mock `Date`."*) and §6 (*"mock `Date` for deterministic today/timestamps."*). In Playwright, `addInitScript` overrides `Date`/`Date.now` before app code runs; in Vitest, `vi.useFakeTimers()` + `vi.setSystemTime('2026-06-14T12:00:00Z')`. The autosave-controller tests use fake timers to assert debounce coalescing and `editing → saving → saved` transitions — only possible because the controller's time source is mockable.

---

## Autosave & drafts

In-progress editing state — a half-configured template in Builder, a partially-filled form in Fill — is the most volatile and least-recoverable data in a localStorage-only app. There is no server to fall back to; if a draft is lost on refresh or a closed tab, the user's work is gone. The governing principle (§2) is **no keystroke lost, no silent data loss, no crash** — every failure resolves to a visible, recoverable state.

### The `Draft` type — separate from `FormInstance`

Drafts are modeled as their own record (see schema above), deliberately *not* as a mutable `FormInstance` or a flag on a `Template`. A draft is keyed by `kind`, references the entity it shadows via `refId`, carries an opaque `payload` (a partial `Template` for Builder, a partial `values` map for Fill), and timestamps each write via `updatedAt`. It lives in its own partitioned keys (`fb:draft:template:<id>` / `fb:draft:instance:<id>`), alongside but never inside the canonical records.

**Rationale — for this app.**
- **Snapshot isolation is the headline invariant.** Keeping drafts in a separate keyspace makes the canonical `Template` / `FormInstance` the only authoritative records; a draft can be malformed, half-migrated, or stale without ever touching them. **Save** (Builder) and **Submit** (Fill) are the *only* transitions that promote draft state into a canonical record.
- **Partition matches the persistence strategy.** A draft is written on a ~700 ms cadence; its own key means an autosave touches one small key, never the templates index or sibling instances.
- **`payload: unknown` is honest about partiality.** A draft is mid-edit — a select with zero options, a calc with no sources, a condition with an incomplete value. Typing the payload as a full `Template` would be a lie the type system can't enforce. `unknown` forces the reader to validate (and migrate, if `schemaVersion` is behind) against the current schema/snapshot before trusting it.
- **`updatedAt` enables both UX and conflict signals.** It feeds the status pill's `saved · <relative time>` and is the comparison key for multi-tab last-writer reconciliation.

**Alternatives rejected.**

| Alternative | Why rejected |
|---|---|
| **A `status: 'draft' \| 'submitted'` flag on `FormInstance`** (one record, mutated in place) | Breaks immutability: a draft mutated on every keystroke *is* the would-be-canonical record, so a mid-edit crash or a bad partial corrupts the only copy. It also leaks drafts into the instances list and defeats snapshot isolation. The separate `Draft` lets `FormInstance` stay write-once. |
| **Same flag on `Template`** (draft = the template with unsaved edits) | Same corruption risk, and it makes **Discard changes** impossible — there's no pristine "last saved" to revert to. Two records (canonical + draft) make Discard trivial: drop the draft key. |
| **One combined `fb:drafts` blob** keyed by id | Re-serializes every draft on every keystroke (the whole-blob-rewrite cost partitioning exists to avoid), and a single quota failure or parse error takes down *all* drafts at once. |
| **In-memory only (no persisted draft)** | Fails the spec's hard requirement that the app work correctly after a full refresh *and* in-progress edits (§5). A refresh, OS tab-discard, or crash would lose everything. |

### The autosave controller — debounce, coalesce, flush, freeze

A single controller (its pure core built in Phase 2, framework-agnostic) drives both Builder and Fill so the behavior — and every failure path — is identical in both modes.

**Debounce + coalesce.** Edits arm a ~700 ms debounced write; rapid edits coalesce into one write of the *latest* draft, not a queue of N writes. This keeps localStorage churn proportional to pauses, not keystrokes — important because each write also serializes the (potentially large) payload.

**Flush on `blur` / `visibilitychange` (→ hidden) / `pagehide`.** The debounce tail — the last few keystrokes still inside the 700 ms window — is the single most common "it didn't save" complaint. When the user blurs the field, backgrounds the tab, or closes it, the controller flushes the pending write immediately. `pagehide`/`visibilitychange` are used (not the unreliable `beforeunload`/`unload`) because they fire on mobile tab-discard and bfcache transitions.

**Rationale — debounce vs throttle.** Throttle guarantees a write every N ms *during* editing, which suits high-frequency streams (scroll, drag) where intermediate frames matter. Here only the *final resting state* of the draft matters and intermediate states are worthless, so debounce minimizes writes for the same durability — with the blur/hide flush closing throttle's only real advantage (bounded staleness) precisely at the moments it matters (tab leave/close) without the constant-churn cost.

**Status state machine.** The controller exposes a status the UI renders as the shared `AutosaveStatus` pill (built in Phase 5, reused by Fill in Phase 6):

```
editing ──(debounce fires / flush)──▶ saving ──(StorageResult.ok)──▶ saved (· relative time)
   ▲                                     │
   └─────────(new edit)──────────────────┘
                                         │
                                         └──(StorageResult not ok)──▶ save-failed  ──(Retry)──▶ saving
```

```ts
type AutosaveStatus =
  | { phase: 'editing' }
  | { phase: 'saving' }
  | { phase: 'saved'; at: ISODateTime }
  | { phase: 'save-failed'; error: 'quota' | 'unavailable' | 'unknown' };
```

The pill is the user's *continuous* "your work is safe" signal — the localStorage equivalent of "All changes saved."

**Freeze-on-failure + manual Retry.** On a non-`ok` write the controller **freezes**: it stops the debounce/auto-retry loop entirely so it never thrashes an already-full quota (retrying into a full disk just burns CPU and flickers the pill), keeps the latest draft **in memory** (the source of truth is now RAM, not the failed key), and raises the recovery dialog. Only a manual **Retry** re-arms the controller. This converts an unbounded failure loop into a single, user-controlled retry.

### The typed `StorageResult<T>` — writes never throw to the UI

Every repository write returns the discriminated `StorageResult<T>` (see schema) instead of throwing. The repository catches `QuotaExceededError` *and* Safari's legacy `QUOTA_EXCEEDED_ERR` and maps to `error: 'quota'`; storage that is absent or throws on access (private mode, blocked cookies, sandboxed iframe) maps to `'unavailable'`; anything else is `'unknown'`. The autosave controller's state machine transitions on `result.ok`, never on a `try/catch`.

**Rationale — typed result vs throw.**
- **Autosave is a background, non-interactive operation.** A thrown `QuotaExceededError` from a debounce timer or a `pagehide` handler has no natural catch site in React's render/event model and would surface as an unhandled rejection or white-screen the app — directly violating §5's "no crash." A typed return forces the single caller (the controller) to handle every variant at the call site, exhaustively.
- **The three error codes map 1:1 to distinct remedies.** `quota` → recovery dialog (export + reclaim + retry); `unavailable` → boot banner / export-only path; `unknown` → generic save-failed with retry. A boolean or a bare `throw` would collapse these into one undifferentiated failure.
- **It's exhaustively testable.** §6 requires unit tests that `StorageResult` maps `quota`/`unavailable`/`unknown` correctly against a throwing storage stub — trivial with a returned value, awkward with thrown errors.

**Boot probe.** `probeStorage()` runs once at startup with a write-then-delete of a sentinel key. If `'unavailable'`, a prominent banner (Phase 5) warns that changes won't persist and offers an export-only path — "better than appearing to work and losing everything on close" (§2). This catches private mode / sandboxed iframes *before* the user invests effort.

### QuotaExceededError recovery dialog

On a `quota` (or `unavailable`) result mid-session, the shared `QuotaRecoveryDialog` (Phase 5, reused by Fill) appears — **a modal dialog, not a transient toast**, because dismissing-by-timeout would strand the user with an unsaved draft and no signal. It (1) explains storage is full and that the current draft is held **in memory** and intact; (2) offers **Export as JSON** — a `Blob` download of the in-memory template or response, so work is never trapped behind a full disk (the universal escape hatch); (3) gives **reclaim-space** guidance (delete old templates/responses); (4) offers **Retry**, which re-arms the frozen controller. The in-memory draft is the source of truth throughout; nothing is discarded until a Retry succeeds.

### Builder draft→commit vs Fill draft→submit

The two modes share the controller but differ in their promotion semantics:

| | **Builder** | **Fill** |
|---|---|---|
| Draft key | `fb:draft:template:<id>` | `fb:draft:instance:<id>` |
| Payload | partial `Template` | partial `values` map |
| Promotion action | **Save** → *commit* | **Submit** |
| On promotion | Write canonical `Template` (bump `updatedAt`, update index). Draft may persist for continued editing; **Discard changes** reverts to last saved. | Write immutable `FormInstance` (with `templateSnapshot`), **then clear the draft**. |
| Save guard | `templateValidation` errors block/hard-warn on Save (§4) | Fill-time `validation`; hidden-required skipped; error summary + focus-first-invalid on failure (§5) |
| Revert path | **Discard changes** → drop draft, reload canonical template | "New Response" → fresh draft; submitted instances immutable, re-download only |

Builder *commits* (the template is long-lived and re-editable, so the canonical record is updated repeatedly and Discard is first-class); Fill *submits once* into a write-once immutable snapshot and then the draft is retired. This is exactly why a separate `Draft` record (not a status flag) is the right model — only one of the two modes even *has* a "last saved version" to revert to.

**Submit-failure safety net.** Submit is where a completed response is most valuable and most at risk. If writing the immutable `FormInstance` returns a non-`ok` `StorageResult`, the controller **does not clear the fill draft**. The user stays on the filled form, the `QuotaRecoveryDialog` appears, and the response survives in both the draft key (if writable) and memory. The draft is cleared *only after* the `FormInstance` write returns `ok: true`. The invariant — **a full disk can never destroy a completed response** — is the single most important ordering rule in the feature: clear-after-confirm, never clear-then-write.

### Multi-tab / conflict considerations

Two tabs editing the same `refId` write to the same draft key. The design's stance:
- **Stable IDs make most reorders/edits commutative** (field order is purely presentational; IDs untouched), so concurrent reorders don't break logic — only last-write-wins on the *array order*.
- **`updatedAt` is the reconciliation key.** A `storage` event from another tab carrying a newer `updatedAt` signals that this tab's in-memory draft is stale; the controller can warn ("This form was edited in another tab") rather than blindly clobbering. The freeze-on-failure model also helps: a frozen tab won't race-write over a healthy tab's progress.
- **No CRDT / no locking.** For a single-user, localStorage-only app, last-writer-wins keyed by `updatedAt` plus a soft cross-tab warning is proportionate; distributed-merge machinery is out of scope (IndexedDB/sync is a parked item, §9).

---

## Relationships, storage layout & referential integrity

This section specifies how the three persisted record kinds relate, how they are partitioned across localStorage, and how referential integrity is preserved (and, in one place, *deliberately broken*) across the synchronous, ~5 MB, no-backend store.

### Snapshot isolation: breaking the live FK on purpose

`FormInstance` carries a full `templateSnapshot` that duplicates data also living in the parent `Template`, which looks like a normalization violation. It is intentional, and it is the keystone of PDF fidelity (the rationale is given in full under **Form Responses** above). The short version: a submitted instance is a historical fact; if it read its field definitions live from the parent, editing the template would silently rewrite history. So `FormInstance.templateId` is a **soft FK** (grouping; may dangle) and `FormInstance.templateSnapshot` is the **hard reference** that every engine reads.

A consequence worth stating explicitly: the model **tolerates a dangling `templateId`** so that deletion order can never make an instance unreadable. The parent template may also be at `schemaVersion` N+1 while an old instance's `templateSnapshot.schemaVersion` is N — migrations run **per record on read**, so the snapshot is migrated independently of the live template. And because `FieldValueMap['fileUpload']` is `FileMeta[]` (metadata only, never bytes), isolation is metadata-faithful, not byte-faithful, by design.

### Partitioned localStorage layout

All persistence sits behind a pure repository over **partitioned keys** (the storage-key map is in "Data model at a glance"). localStorage is **synchronous and string-only**: every write serializes a whole key's value and blocks the main thread. §1 chose the repository specifically because *"partition avoids whole-blob rewrites,"* and Phase 2's acceptance criterion makes this testable: *"saving one template doesn't rewrite others."* Concretely:

- A single monolithic `fb:appState` blob would force every debounced autosave keystroke to re-serialize **every** template and instance — O(total data) on the UI thread per ~700 ms tick. Partitioning makes an autosave write O(one record).
- Instances are bucketed **per template** (`fb:instances:<templateId>`) rather than one global instances key, so a busy template's submissions don't bloat unrelated writes, and **cascade-delete is a single key removal**.
- The `index` is separated from full template bodies so the **home list renders without parsing every field array** of every template — it reads one small key, not N large ones, supporting the list-virtualization plan (Phase 8).
- Drafts live in their **own keys** so transient, high-frequency autosave traffic never touches the canonical `fb:template:<id>` / `fb:instances:<id>` records. This is also what lets **Discard changes** work — the committed record is untouched until Save.

**Alternatives rejected.** *Single JSON blob* (O(total) write per keystroke; one corrupt write loses everything). *One key per instance* (`fb:instance:<instanceId>`) (listing a template's instances would require a full `localStorage` key scan + filter, and cascade-delete becomes N removals — the per-template bucket gives O(1) list-load and O(1) cascade; the cost of rewriting the whole bucket to append one submission is acceptable because instances are written once on Submit, not per keystroke). *Namespacing via a sub-object* (defeats whole-blob-rewrite avoidance — you can't write a nested object without rewriting its parent key).

**Edge cases.** *Index drift* — `fb:templates:index` is a denormalized cache; the repository treats per-record keys as source of truth and the index as rebuildable, and card counts (field count, instance count, last-modified) are derived and self-healing on next write. *Orphaned instance bucket* — if a template record is gone but `fb:instances:<templateId>` survives (interrupted delete), it's reclaimable via the quota-recovery "reclaim space" path. *Key collisions* — IDs are `crypto.randomUUID()`, so keys never collide.

### Referential integrity

Because fields, options, conditions, and calculations all reference each other **by stable ID**, integrity work is concentrated entirely at **deletion** time. Reorder is free (IDs untouched); deletion is where references can dangle. The system gives a two-layer guarantee: the **builder warns before** you delete (preventing accidental breakage), and the **engines stay correct after** you delete anyway (preventing crashes from any dangling reference, however it arose — including drift from migrations or hand-edited storage).

**Deleting a field referenced by a condition or calc.** Per §5, deleting a field that is a **condition target** or **calc source** triggers a **warn-and-list-dependents** dialog; on confirm, dependents' conditions **go inert** (their `targetFieldId` now dangles) and are **flagged** by `templateValidation`, while calc `sourceFieldIds` **drop the deleted ID**. The engines tolerate the dangling state so a stale reference is never a crash:
- `conditionEngine` — a dangling target makes the condition inert; the owning field uses its default (§4). The fixpoint resolver treats a missing target's value as absent.
- `calculationEngine` — a source is excluded from the set when hidden, empty/null, or deleted (§4); `avg/min/max` of the resulting empty set is `null` (blank), never `0`/`NaN`.
- `templateValidation` — surfaces "condition with no target / dangling target" and "calc with no / invalid / calc-typed sources" as issues, so the builder shows the breakage rather than hiding it.

**Deleting a select option referenced by a condition value.** A `singleSelect`/`multiSelect` condition stores option **IDs** in its `value`. Per §5, deleting a referenced option means "the stale option ID never matches (inert); builder flags it." No cascade rewrite is performed — the comparison in `evaluateCondition` can never be satisfied by a value that can no longer be selected, and `templateValidation` flags the now-incomplete condition. §3 reinforces that "an empty/incomplete value makes the condition inert (non-matching), never an error at fill time." *Alternative rejected:* cascading option deletes into every condition's `value` — destructive (silently mutates the user's logic) and unnecessary; "inert + flagged" is both safe at fill time and visible at build time.

**Safe-reversible template delete (cascade + count-named confirm + ~6 s Undo).** Deleting a template is the one place a real cascade fires, because the parent→children FK (`templateId`) is authoritative for grouping. Per §5 and Phase 8:

1. **Confirm naming the exact count** — *"…and its N responses — can't be undone."* N is read from the `fb:instances:<templateId>` bucket length. Naming the count prevents one-click loss of, say, 200 submissions.
2. **Cascade-delete**: remove `fb:template:<id>`, its `fb:instances:<templateId>` bucket, and any open `fb:draft:template:<id>`; update `fb:templates:index`. The per-template bucket layout makes the instance cascade a **single key removal**.
3. **~6 s Undo toast** backed by a temporary `fb:trash` snapshot holding **both** the template and its instances. Click Undo within the window → records restored from `fb:trash`; otherwise `fb:trash` is **purged**. §5 frames this as avoiding *"both silent data loss and orphaned-instance clutter."*

```ts
// Conceptual shape of the temporary trash entry (one at a time, key fb:trash)
interface TrashEntry {
  template: Template;
  instances: FormInstance[];
  deletedAt: ISODateTime;   // basis for the ~6s purge window
}
```

**Rationale.** A no-backend app has no "deleted_at" soft-delete column and no server-side recycle bin; `fb:trash` is the client-side equivalent, scoped to a single short-lived undo so it never accumulates against the ~5 MB quota long-term. Cascading (rather than orphaning) keeps instance buckets from leaking; because the deleted instances were already self-contained (snapshot isolation), restoring them is a verbatim re-put — no re-linking needed. *Alternatives rejected:* immediate hard delete with no undo (one misclick destroys all submissions); a persistent recycle bin (unbounded growth against the quota); orphaning instances (dead `fb:instances:<templateId>` buckets + confusing UI counts).

**Edge cases.** *Quota failure mid-delete or during the trash write* — all writes go through `StorageResult` and never throw; a failed `fb:trash` write degrades gracefully (the delete can be aborted rather than performed without an undo net). *Second delete inside the window* — `fb:trash` holds one entry; a new delete replaces it (committing the prior delete), and the window is short by design to keep this unambiguous. *Refresh during the window* — the toast is transient UI; once `fb:trash` is purged or the page reloads past the window, the delete is final, consistent with the "can't be undone" wording.

---

## Consolidated decision ledger

A single comparative table of the load-bearing schema decisions. The grading axes are abbreviated: **PT** product thinking · **EXT** extensibility · **TS** type safety · **CC** conditional correctness · **PDF** PDF quality · **RD** refresh durability. The "deciding criterion" is the axis (or axes) that broke the tie *for this product* — not the only axis a choice touches.

| # | Decision | Chief alternative(s) | Trade-off | Deciding reason (this app) | Criterion |
|---|----------|----------------------|-----------|----------------------------|-----------|
| 1 | **`templateSnapshot` embedded in every `FormInstance`** | Store only `templateId`; resolve the live `Template` at read/export | Data duplication + larger instance blobs vs. faithful historical reproduction | No backend to version templates; a submitted response must re-export identically *after* the template is edited or deleted. The snapshot is the response's frozen world. | PDF, PT |
| 2 | **Separate mutable `Draft`, distinct from the immutable `FormInstance`** (and the committed `Template`) | One mutable record per entity; "submitted" is just a boolean flag | Two record shapes + a clear-on-commit step vs. immutability + clean refresh restore | Refresh durability needs an in-progress store that survives reload *without* corrupting committed data; immutability of submitted instances must be structural, not a flippable flag. | RD, PT |
| 3 | **Partitioned localStorage keys** (`fb:template:<id>`, `fb:instances:<templateId>`, `fb:draft:*`, `fb:templates:index`, `fb:trash`) | One monolithic JSON blob under a single key | More keys + an explicit index to maintain vs. avoiding whole-blob rewrites | A debounced autosave that rewrote *all* templates per keystroke would amplify quota pressure and write cost; partitioning means one draft write touches one key. | RD, PT |
| 4 | **Typed `StorageResult<T>` returned from every write (never throw)** | `try/catch` per call site; or let `QuotaExceededError` propagate to an error boundary | Explicit result-handling at call sites vs. invisible, crash-prone failures | localStorage is the *only* store; a quota/unavailable failure must become a recovery dialog with Export-as-JSON, not a white screen. The type forces every caller to handle `quota`/`unavailable`/`unknown`. | TS, RD |
| 5 | **`schemaVersion: number` on `Template` + `TemplateSnapshot`, migrated on read** | No version field; or migrate-on-write; or a global store version | A version field on every record + a migration runner vs. brittle reads of legacy data | Persisted data outlives any deploy; users return with old blobs. Migrate-on-read upgrades lazily, and snapshots carry their *own* version so old responses migrate independently of the live template. | EXT, RD |
| 6 | **Mapped discriminated union for `Field`** | Hand-written union of 9 interfaces; or a single `config: Record<string, unknown>` bag | One dense mapped type vs. 9 repetitive interfaces; strictness vs. convenience | Narrowing on `.type` must yield the matching `config` *and* value types so registry, validation, and PDF stay type-safe. Adding an 11th type is one key in `FieldConfigMap` — TS then forces every switch to follow. | TS, EXT |
| 7 | **`conditions: Condition[]` is a property of `FieldBase`, not a 10th field type** | A dedicated `conditionalLogic` field type per the spec's "10 types" reading | Reinterpreting the spec vs. modeling logic as data on every field | Conditional logic applies *to* fields (show/hide/require); it is not something a user "adds to the canvas." As a property it composes with all 9 types uniformly and the engine sees a flat, order-independent graph. | CC, EXT |
| 8 | **Conditions/calcs reference fields by stable `id` (`crypto.randomUUID`); array order is purely presentational** | Reference by array index or by label | UUID indirection vs. logic that silently rebinds on reorder/rename | Reorder is a first-class UX (DnD across three surfaces); index/label references would corrupt logic on every move or rename. Stable IDs make reordering a no-op for correctness. | CC, EXT |
| 9 | **Dropped redundant `required`; `defaultRequired` / `defaultVisibility` are the base states** | Keep a separate `required` plus a `defaultRequired` | One source of truth vs. two fields that can disagree | The condition engine computes *effective* required/visible from a base state plus matching effects (last-match-wins). A second `required` field creates an ambiguous base and "which one wins" bugs. | CC, TS |
| 10 | **`fileUpload` stores `FileMeta[]` metadata only — never bytes** | Base64-encode file bytes into localStorage | Re-opened files show metadata only (cannot re-materialize the `File`) vs. blowing the quota | A few real files would exhaust localStorage; the PDF explicitly renders a "file content not included" note. Metadata is enough for validation (count, accepted-type) and a faithful PDF row. | PT, PDF |
| 11 | **PDF generated on demand from `snapshot` + stored `values`, never persisted** | Store the generated PDF blob alongside the instance | Recompute on every download vs. a large, redundant, stale binary in storage | `visibleFieldIds` are *recomputed* by running the condition engine over the snapshot, so re-download is deterministic and storage stays lean. A stored PDF could drift from the values. | PDF, RD |
| 12 | **Dates are `ISODate` strings (`YYYY-MM-DD`), compared as strings** | `Date` objects / epoch millis / full `ISODateTime` | No time-of-day math vs. timezone off-by-one bugs | Form dates are local calendar dates; string compare is timezone-proof and serializes losslessly. "Today" prefill uses local time and is mocked in tests. | CC, PT |
| 13 | **Two timestamps on `Template` (`createdAt`/`updatedAt`); `submittedAt` on `FormInstance`; `updatedAt` on `Draft`** | A single timestamp; or none | Slightly more bookkeeping vs. observable lifecycle | The lists screen sorts by last-modified; the autosave pill shows a relative "saved" time from the draft's `updatedAt`; the PDF prints `submittedAt`. Each answers a concrete UI question. | PT, RD |
| 14 | **Safe-reversible cascade delete via a temporary `fb:trash` snapshot + ~6 s Undo** | Hard delete immediately; or soft-delete flags that linger forever | A transient extra key + a purge step vs. silent data loss or orphan clutter | Deleting a template must also delete its responses (no orphans), but a misclick must be recoverable without a backend trash bin. `fb:trash` holds template + instances until Undo lapses. | PT |
| 15 | **`ConditionValue` is a union including `{ min: number; max: number }`** | A single scalar `value` plus a separate `valueMax` | One field that's sometimes a range vs. two fields one of which is usually null | `withinRange` needs a pair; modeling it as a union member keeps the editor "per (target type × operator)" and makes incomplete values *inert*, not errors. | CC, TS |
| 16 | **Boot-time `probeStorage(): 'writable' \| 'unavailable'`** | Discover storage failure lazily on first write | An extra startup check vs. appearing to work then losing everything on close | Private mode / blocked cookies / sandboxed iframes silently swallow writes. Probing at boot lets the app warn up front and offer an export-only path. | RD, PT |

### Why these interlock

The headline decisions are not independent — they reinforce one another:

- **#1 (snapshot) + #5 (per-record `schemaVersion`)**: snapshots carry their own version so old responses migrate independently of a drifted template; #5 is what makes #1 forward-compatible.
- **#2 (separate `Draft`) + #3 (partitioned keys) + #4 (`StorageResult`)**: the draft lives in its own key, autosave touches only that key, and a failed write on it freezes autosave + raises the recovery dialog. The **submit-failure safety net** is the highest-stakes consumer of #4 — a non-`ok` `FormInstance` write must *not* clear the draft, so a full disk can never destroy a completed response.
- **#6 (mapped union) + #5 (migrate-on-read)**: the mapped-union `FieldConfigMap` can grow an 11th field type, and migrate-on-read upgrades existing data into the new shape without stranding it.
- **#7 (conditions as a property) + #8 (stable-ID references)**: logic is data attached to the field it governs, the engine sees a flat order-independent graph, and references survive every reorder/rename — so reorder is a guaranteed no-op for correctness and needs no "can't move above a dependency" rule. This is also exactly why redundant `required` was dropped (#9): effective state is computed (last-match-wins over the default base), so a second source would be ambiguous.

---

## Edge cases & testing appendix

### Conditional logic & calculation
- Hidden field never validated as required, even if marked required; its value is excluded from submission, PDF, downstream conditions, and calculations.
- Chained A→B→C resolves to a stable fixpoint; hiding B removes B's value from C's condition.
- Self-reference is forbidden in the UI and ignored at eval (`targetFieldId` must differ from the owning field — enforceable because the comparison is ID-to-ID).
- Cycles detected ⇒ deterministic fallback to defaults + builder warning.
- Dangling reference (deleted target) ⇒ condition inert; owning field uses its default; builder flags it.
- Multiple conditions ⇒ last-match-wins per axis (documented).
- Calc source deleted/hidden/empty ⇒ excluded from the set; `avg/min/max` of empty set ⇒ blank, never `0`/`NaN`; calc-source-calc blocked in UI and at eval; rounding applied to the result only.
- Incomplete `ConditionValue` (incl. a stale option ID) ⇒ inert, never a fill-time error.
- **Tested by:** the exhaustive condition-engine unit matrix (every operator per type, chained, hidden-value exclusion, self-ref, cycles, multi-condition precedence) and calculation-engine tests (each aggregation, empty/hidden/deleted sources, decimals, calc-source-calc rejection); E2E proving a reorder does not break an existing condition. 100% coverage gate on `src/domain`.

### Templates & fields
- `Esc` mid-drag restores the original array order; a drop outside a valid zone is a no-op; identity move (drop on own position) is a no-op permutation; empty `fields[]` is valid (empty-canvas dropzone).
- Selected-field (config panel) state preserved across a reorder — selection is keyed by field **ID**.
- Title cleared by the user ⇒ inline editor restores "Untitled form"; the default flows into `TemplateSnapshot.title`, so even an untitled form produces a titled PDF.
- A future 10th/11th field type cannot be silently dropped — every `switch (field.type)` ends in `assertNever`.
- **Tested by:** pure-fn tests for `moveItem`/`insertField` (boundaries, no-op, identity); a test proving a stub `phone` type wires into palette/config/fill/PDF/operators with **no edits to existing files** (Phase 4); reducer coverage incl. the `assertNever` default; per-field component round-trips (ConfigEditor ⇄ FillRenderer).

### Responses, snapshots & temporal
- Template edited/deleted after submit ⇒ instance untouched; re-download reflects the form *as submitted*; delete uses the reversible cascade.
- Stale option IDs in `values` always resolve to the snapshot's frozen labels.
- Hidden-required at submit does not block and is excluded from `values`, on every future recompute.
- File fields hold `FileMeta[]` only; PDF renders the "file content not included" note.
- Date off-by-one structurally prevented (string compare, never `new Date()`); prefill-today reads **local** date parts and fires only on new-instance open; min/max `Date` math is DST-immune.
- `minDate > maxDate` in the builder ⇒ a `templateValidation` date-bounds error at build time, separate from fill-time validation.
- Clock skew (no trusted server time) ⇒ timestamps reflect the device clock; sorting still totals; relative formatting must render "just now"/absolute, never a negative "in -3 minutes."
- Tie in sort timestamps ⇒ stable `id` secondary key (no flicker).
- **Tested by (unit):** repository CRUD round-trips under partitioned keys; `values`-validated-on-read narrowing against a snapshot; v0→v1 migration via pinned `schemaVersion`; validation date string-compare with mocked `Date`; prefill-today (`vi.setSystemTime` — local date, no-overwrite on existing draft, late-night/next-day-UTC case); sort ordering with the `id` tie-break. **Tested by (E2E):** the decisive *"Instances list + re-download after the template is edited (snapshot integrity)"* (submit → edit template → re-download → assert original labels present, hidden labels absent, `%PDF` header); `Date` mocked for deterministic `submittedAt`/today.

### Persistence, autosave & storage failure
- Full refresh restores the current screen (URL route) AND in-progress edits (autosaved drafts); conditional/calc state is recomputed from restored values, not persisted.
- Debounce tail on tab close/background flushed via `pagehide`/`visibilitychange`/`blur`.
- Quota hit mid-autosave ⇒ freeze, keep in-memory draft, recovery dialog, no retry storm; quota hit on Submit ⇒ draft not cleared, user stays on form (response not lost).
- Storage unavailable at boot (private mode / sandboxed iframe) ⇒ `probeStorage()` → banner + export-only.
- Safari legacy `QUOTA_EXCEEDED_ERR` mapped alongside the standard `QuotaExceededError`.
- Discard changes (Builder) ⇒ drop the draft key, reload canonical template; no orphaned draft.
- Stale/incoherent draft ⇒ `payload: unknown` validated (and migrated) on restore; an unparseable draft degrades to the last canonical record rather than crashing.
- Submit success ⇒ draft cleared *only after* the `FormInstance` write returns `ok: true` (clear-after-confirm).
- Multi-tab same-id edit ⇒ last-writer-wins by `updatedAt`, with a soft cross-tab staleness warning via the `storage` event.
- Index drift ⇒ index treated as rebuildable; counts self-heal on next write. Orphaned instance bucket ⇒ reclaimable via the recovery path. Second delete inside the undo window ⇒ `fb:trash` holds one entry and replaces.
- **Tested by (unit):** `StorageResult` maps `quota`/`unavailable`/`unknown` (incl. Safari's legacy code) against a throwing stub; `probeStorage()` returns `'unavailable'`; autosave-controller debounce coalescing, flush on `blur`/`visibilitychange`/`pagehide`, freeze-on-failure + Retry re-arm, status transitions (fake timers + mocked storage); draft autosave + restore + clear-on-submit/commit per mode; **partition proof** — saving one template/draft doesn't rewrite siblings/index. **Tested by (E2E):** edit → pill reaches `saved` → reload restores; `pagehide` flushes the last keystrokes; `setItem` stubbed to throw quota ⇒ `save failed` + `QuotaRecoveryDialog` + working Export-as-JSON + surviving draft; Submit under simulated quota keeps the response; boot probe shows the private-mode banner; delete-then-Undo restores template + instances within the window.

---

## Future considerations

These are documented, not built (§9 parking lot), and the schema is shaped so each is a back-end change rather than an app rewrite.

**IndexedDB migration path.** The repository/storage-adapter split (storage access behind a thin, mockable adapter; the autosave core framework-agnostic) is precisely the seam that makes swapping localStorage for IndexedDB tractable:
- The same partitioned key space maps cleanly onto IndexedDB **object stores** (`templates`, `instances` keyed by `[templateId, id]`, `drafts`, `trash`) — the `fb:instances:<templateId>` bucket becomes an indexed query on `templateId` instead of one big value, which also removes the "rewrite the whole bucket to append one instance" cost.
- IndexedDB is **async**, so the real work is making the repository return Promises; the existing `StorageResult<T>` discriminated union is already the right shape to wrap async success/failure, and the autosave controller's debounce + freeze-on-failure state machine is unchanged.
- Snapshot isolation, the soft/hard FK split, and the referential-integrity rules are **storage-engine-independent** — properties of the records, so they carry over verbatim.
- Migration-on-read extends naturally: a one-time `schemaVersion`-style data migration can copy existing localStorage records into IndexedDB on first boot after the swap.

**Multi-tab synchronization.** Today's stance is last-writer-wins keyed by `Draft.updatedAt` plus a soft cross-tab warning via the `storage` event — proportionate for a single-user app. A future revision could promote this to a `BroadcastChannel`-driven live sync, or (with IndexedDB) a leader-tab lock. Distributed-merge / CRDT machinery remains out of scope unless real concurrent multi-device editing becomes a requirement.

**Export / import.** Export-as-JSON already exists as the quota escape hatch (a `Blob` download of the in-memory template or response). A natural extension is full template/response **import** — re-hydrating an exported JSON through the same migrate-on-read + `StorageResult` write path, which would also serve as a manual backup/restore and a cross-device transfer mechanism without a backend. A "branded types" hardening for `ISODate`/`ISODateTime` and a builder-side "lint" panel summarizing dangling refs / cycles / unreachable fields are also parked candidates if mix-ups or complex-logic debugging ever surface.
