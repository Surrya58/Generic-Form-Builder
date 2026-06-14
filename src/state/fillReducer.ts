import { assertNever } from '../domain'

/** Transient state for one form being filled out. */
export interface FillState {
  templateId: string
  instanceId: string
  /** Entered values keyed by field id. */
  values: Record<string, unknown>
}

export type FillAction =
  | { type: 'setValue'; fieldId: string; value: unknown }
  | { type: 'reset'; values: Record<string, unknown> }

export interface FillInit {
  templateId: string
  instanceId: string
  values: Record<string, unknown>
}

export function createInitialFillState(init: FillInit): FillState {
  return { templateId: init.templateId, instanceId: init.instanceId, values: init.values }
}

export function fillReducer(state: FillState, action: FillAction): FillState {
  switch (action.type) {
    case 'setValue':
      return { ...state, values: { ...state.values, [action.fieldId]: action.value } }
    case 'reset':
      return { ...state, values: action.values }
    default:
      return assertNever(action)
  }
}
