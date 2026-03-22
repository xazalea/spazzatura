/**
 * ValidationLoop — Orchestrates the coder→validator→fix cycle
 *
 * Implements the "no mistakes" dual-agent pattern:
 *   1. Coder agent makes changes
 *   2. Validator checks every touched file
 *   3. If issues found → coder fixes → validator re-checks
 *   4. Max 5 iterations, then escalate to human
 */

import { ValidatorAgent } from './validator-agent.js';
import type { ValidatorOptions, ValidationResult } from './validator-agent.js';

export interface ValidationLoopOptions {
  /** Maximum fix iterations before giving up */
  maxIterations?: number;
  /** Validator options */
  validatorOptions?: ValidatorOptions;
  /** Callback after each validation round */
  onValidation?: (result: ValidationResult, iteration: number) => Promise<void> | void;
  /** Callback to request fixes from coder */
  onFixRequest?: (report: string, iteration: number) => Promise<void> | void;
}

export interface LoopResult {
  /** Whether validation ultimately passed */
  passed: boolean;
  /** Total iterations run */
  iterations: number;
  /** Final validation result */
  finalResult: ValidationResult;
  /** Whether max iterations was hit without passing */
  escalated: boolean;
}

/**
 * Run the validation loop until code passes or max iterations reached
 */
export async function runValidationLoop(
  files: string[],
  options: ValidationLoopOptions = {}
): Promise<LoopResult> {
  const maxIterations = options.maxIterations ?? 5;
  const validator = new ValidatorAgent(options.validatorOptions ?? {});

  let iteration = 0;
  let lastResult: ValidationResult | null = null;

  while (iteration < maxIterations) {
    iteration++;

    // Run validation
    const result = await validator.validate(files);
    lastResult = result;

    // Notify callback
    if (options.onValidation) {
      await options.onValidation(result, iteration);
    }

    if (result.passed) {
      return {
        passed: true,
        iterations: iteration,
        finalResult: result,
        escalated: false,
      };
    }

    // If more iterations allowed, request fixes
    if (iteration < maxIterations) {
      const report = ValidatorAgent.formatReport(result);
      if (options.onFixRequest) {
        await options.onFixRequest(report, iteration);
      }
    }
  }

  // Exhausted iterations
  return {
    passed: false,
    iterations: iteration,
    finalResult: lastResult!,
    escalated: true,
  };
}

/**
 * Single-shot validation — no retry loop
 */
export async function validateOnce(
  files: string[],
  options: ValidatorOptions = {}
): Promise<ValidationResult> {
  const validator = new ValidatorAgent(options);
  return validator.validate(files);
}
