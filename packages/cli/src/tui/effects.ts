/**
 * TTE (terminaltexteffects) subprocess wrappers.
 * Spawns `tte` as a subprocess with stdio: ['pipe', 'inherit', 'inherit']
 * so TTE writes ANSI animations directly to the user's terminal.
 * Falls back to plain stdout.write() if TTE is not installed.
 */

import { spawn } from 'child_process';

export type EffectName = 'print' | 'errorcorrect' | 'highlight' | 'unstable';

const EFFECT_ARGS: Record<EffectName, string[]> = {
  print:        ['print', '--typing-speed', '2', '--frame-rate', '60'],
  errorcorrect: ['errorcorrect', '--frame-rate', '60'],
  highlight:    ['highlight', '--frame-rate', '60'],
  unstable:     ['unstable', '--frame-rate', '60'],
};

export async function playEffect(text: string, effect: EffectName): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('tte', EFFECT_ARGS[effect], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    proc.stdin?.write(text);
    proc.stdin?.end();
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error(`tte exited ${code}`))));
    proc.on('error', reject);
  });
}

/** Play a TTE effect; fall back to plain write if TTE is unavailable. */
export async function display(text: string, effect: EffectName): Promise<void> {
  try {
    await playEffect(text, effect);
  } catch {
    process.stdout.write(text + '\n');
  }
}

/** Play each part of an AI response with the appropriate effect. */
export async function displayResponse(response: string): Promise<void> {
  const isDiff = /^```diff/m.test(response);
  const hasCode = /^```/m.test(response);

  if (isDiff) {
    await display(response, 'errorcorrect');
    return;
  }

  if (hasCode) {
    // Split on code fences, apply print+highlight per code block
    const parts = response.split(/(```[\s\S]*?```)/g);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('```')) {
        await display(trimmed, 'print');
        const codeOnly = trimmed.split('\n').slice(1, -1).join('\n');
        if (codeOnly.trim()) await display(codeOnly, 'highlight');
      } else {
        await display(trimmed, 'print');
      }
    }
    return;
  }

  await display(response, 'print');
}

export async function checkTte(): Promise<boolean> {
  return new Promise(resolve => {
    const p = spawn('tte', ['--version'], { stdio: 'ignore' });
    p.on('close', c => resolve(c === 0));
    p.on('error', () => resolve(false));
  });
}

export async function autoInstallTte(): Promise<void> {
  return new Promise(resolve => {
    const p = spawn('pip', ['install', 'terminaltexteffects', '-q'], { stdio: 'ignore' });
    p.on('close', () => resolve());
    p.on('error', () => resolve());
  });
}
