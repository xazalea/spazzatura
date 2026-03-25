/**
 * Ultrawork detection and model override.
 *
 * Ported from vendor/oh-my-openagent/src/plugin/ultrawork-model-override.ts
 *
 * "Ultrawork" is a mode where the agent switches to a more powerful model
 * for complex tasks. It is triggered by the keywords `ultrawork` or `ulw`
 * in the user's prompt (outside of code blocks).
 */

// ============================================================================
// Detection
// ============================================================================

const CODE_BLOCK = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`]+`/g;
const ULTRAWORK_PATTERN = /\b(ultrawork|ulw)\b/i;

/**
 * Returns true if `text` contains the ultrawork/ulw trigger keyword outside
 * of any code block or inline-code span.
 *
 * Mirrors `detectUltrawork()` from vendor source verbatim.
 */
export function detectUltrawork(text: string): boolean {
  const clean = text.replace(CODE_BLOCK, '').replace(INLINE_CODE, '');
  return ULTRAWORK_PATTERN.test(clean);
}

// ============================================================================
// Override resolution
// ============================================================================

/**
 * Agent-specific ultrawork configuration (subset of the full agent override
 * schema; only the ultrawork fields are needed here).
 */
export interface UltraworkConfig {
  /** Full model identifier in `providerID/modelID` format, e.g. `anthropic/claude-opus-4-5` */
  model?: string;
  /** Optional variant override (e.g. `thinking`) */
  variant?: string;
}

/**
 * Available models supplied by the runtime for validation.
 */
export interface AvailableModel {
  providerID: string;
  modelID: string;
  /** Variants / features supported by this model */
  variants?: string[];
}

/**
 * Result of ultrawork override resolution.
 */
export interface UltraworkOverrideResult {
  providerID?: string;
  modelID?: string;
  variant?: string;
}

/**
 * Resolve the ultrawork model override for an agent given its configuration.
 *
 * Returns `null` if the prompt does not contain the ultrawork keyword, or if
 * no ultrawork configuration is present for the agent.
 *
 * Mirrors `resolveUltraworkOverride()` from vendor source.
 *
 * @param promptText      The user's prompt text (code blocks already stripped
 *                        by the caller, or pass raw — this function re-strips)
 * @param ultraworkConfig The agent's ultrawork override configuration
 */
export function resolveUltraworkOverride(
  promptText: string,
  ultraworkConfig: UltraworkConfig | undefined,
): UltraworkOverrideResult | null {
  if (!detectUltrawork(promptText)) return null;
  if (!ultraworkConfig) return null;
  if (!ultraworkConfig.model && !ultraworkConfig.variant) return null;

  // Variant-only override
  if (!ultraworkConfig.model) {
    const r: UltraworkOverrideResult = {};
    if (ultraworkConfig.variant !== undefined) r.variant = ultraworkConfig.variant;
    return r;
  }

  const modelParts = ultraworkConfig.model.split('/');
  if (modelParts.length < 2) return null;

  const result: UltraworkOverrideResult = {
    modelID: modelParts.slice(1).join('/'),
  };
  if (modelParts[0] !== undefined) result.providerID = modelParts[0];
  if (ultraworkConfig.variant !== undefined) result.variant = ultraworkConfig.variant;
  return result;
}

/**
 * Validate the requested variant against the available models list.
 *
 * Returns the variant string if the target model supports it, otherwise
 * returns `undefined`.
 *
 * Mirrors `resolveValidUltraworkVariant()` from vendor source.
 *
 * @param availableModels  List of models with their supported variants
 * @param targetModel      The resolved model to check variant support against
 * @param variant          The variant to validate
 */
export function resolveValidUltraworkVariant(
  availableModels: AvailableModel[],
  targetModel: { providerID: string; modelID: string } | undefined,
  variant: string | undefined,
): string | undefined {
  if (!variant || !targetModel) return undefined;

  const match = availableModels.find(
    (m) => m.providerID === targetModel.providerID && m.modelID === targetModel.modelID,
  );

  if (!match) return undefined;
  if (!match.variants || match.variants.length === 0) return undefined;
  return match.variants.includes(variant) ? variant : undefined;
}

/**
 * Apply the ultrawork override to a chat message payload in place.
 *
 * Updates `message.model` and optionally `message.variant` / `message.thinking`
 * if the prompt triggers ultrawork mode and a valid override is configured.
 *
 * @param promptText       Full text of the user prompt
 * @param ultraworkConfig  Agent's ultrawork configuration
 * @param message          Mutable message record (modified in place)
 * @param availableModels  Available models for variant validation (optional)
 * @returns The resolved override result, or null if no override applied
 */
export function applyUltraworkOverride(
  promptText: string,
  ultraworkConfig: UltraworkConfig | undefined,
  message: Record<string, unknown>,
  availableModels?: AvailableModel[],
): UltraworkOverrideResult | null {
  const override = resolveUltraworkOverride(promptText, ultraworkConfig);
  if (!override) return null;

  // Validate variant if we have the available models list
  let validatedVariant: string | undefined;
  if (availableModels && override.variant) {
    const targetModel = override.providerID && override.modelID
      ? { providerID: override.providerID, modelID: override.modelID }
      : (message['model'] as { providerID: string; modelID: string } | undefined);
    validatedVariant = resolveValidUltraworkVariant(availableModels, targetModel, override.variant);
  } else {
    validatedVariant = override.variant;
  }

  // Apply variant
  if (validatedVariant) {
    message['variant'] = validatedVariant;
    message['thinking'] = validatedVariant;
  }

  // Apply model override
  if (override.providerID && override.modelID) {
    const currentModel = message['model'] as { providerID?: string; modelID?: string } | undefined;
    const alreadyActive =
      currentModel?.providerID === override.providerID &&
      currentModel?.modelID === override.modelID;

    if (!alreadyActive) {
      message['model'] = { providerID: override.providerID, modelID: override.modelID };
    }
  }

  return override;
}
