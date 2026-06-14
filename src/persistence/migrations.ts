/** Bump whenever a record shape changes and a migration step is added below. */
export const CURRENT_SCHEMA_VERSION = 1

/** Every value written to localStorage is wrapped in this envelope. */
export interface StoredEnvelope<T> {
  schemaVersion: number
  data: T
}

export type RecordKind = 'template' | 'templatesIndex' | 'instances' | 'draft' | 'trash'

/** Upgrades a record from the version it's keyed under to version + 1. */
type MigrationStep = (data: unknown) => unknown

const migrationsByKind: Record<RecordKind, Record<number, MigrationStep>> = {
  template: {
    // v0 templates predate `updatedAt`; backfill it from `createdAt`.
    0: (data) => {
      const record = data as Record<string, unknown>
      return {
        ...record,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : record.createdAt,
      }
    },
  },
  templatesIndex: {},
  instances: {},
  draft: {},
  trash: {},
}

/** Applies every pending migration step for `kind`, bringing the envelope up to CURRENT_SCHEMA_VERSION. */
export function migrateEnvelope<T>(
  kind: RecordKind,
  envelope: StoredEnvelope<unknown>,
): StoredEnvelope<T> {
  const chain = migrationsByKind[kind]
  let schemaVersion = envelope.schemaVersion
  let data = envelope.data

  while (schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = chain[schemaVersion]
    if (!step) break
    data = step(data)
    schemaVersion += 1
  }

  return { schemaVersion: CURRENT_SCHEMA_VERSION, data: data as T }
}
