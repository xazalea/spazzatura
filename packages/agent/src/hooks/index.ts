/**
 * Hooks subsystem for the Spazzatura agent package.
 *
 * Re-exports the registry singleton and all hook-related types.
 */

export {
  HookRegistry,
  hookRegistry,
} from './registry.js';

export type {
  HookType,
  HookPayloads,
  HookHandler,
  ChatMessagePayload,
  ToolBeforePayload,
  ToolAfterPayload,
  SystemTransformPayload,
  ChatParamsPayload,
} from './registry.js';

export {
  detectUltrawork,
  resolveUltraworkOverride,
  resolveValidUltraworkVariant,
  applyUltraworkOverride,
} from './ultrawork.js';

export type {
  UltraworkConfig,
  UltraworkOverrideResult,
  AvailableModel,
} from './ultrawork.js';
