import { ensurePython } from './detect.js';
import { runPythonEffect } from './runner.js';
import {
  errorCorrectFallback,
  printFallback,
  thunderstormFallback,
  spotlightsFallback,
} from './fallback.js';

export type EffectName = 'errorCorrect' | 'print' | 'thunderstorm' | 'spotlights';

let pythonAvailable: boolean | null = null;

// Map our effect names to terminaltexteffects CLI effect names
const EFFECT_MAP: Record<EffectName, string> = {
  errorCorrect: 'errorcorrect',
  print: 'print',
  thunderstorm: 'thunderstorm',
  spotlights: 'spotlights',
};

export async function runEffect(effect: EffectName, text: string): Promise<void> {
  if (pythonAvailable === null) {
    pythonAvailable = await ensurePython();
  }

  if (pythonAvailable) {
    await runPythonEffect(EFFECT_MAP[effect], text);
  } else {
    switch (effect) {
      case 'errorCorrect':
        await errorCorrectFallback(text);
        break;
      case 'print':
        await printFallback(text);
        break;
      case 'thunderstorm':
        await thunderstormFallback(text);
        break;
      case 'spotlights':
        await spotlightsFallback(text);
        break;
    }
  }
}
