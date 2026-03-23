/**
 * TUI entry point — Ink-based React terminal interface with TTE effect integration.
 *
 * Mount/unmount loop:
 *   1. Render App with Ink
 *   2. App buffers AI response and calls onTTERequest(response, newState)
 *   3. We unmount Ink (releases terminal)
 *   4. Play TTE effect via subprocess (writes ANSI directly to terminal)
 *   5. Remount App with updated state — goto 1
 *   6. User quits → exit loop
 */

import type { GlobalOptions } from '../index.js';
import { checkTte, autoInstallTte, displayResponse, display } from './effects.js';
import { loadSettings } from './app.js';
import type { SharedState } from './app.js';

export interface TUIOptions {
  readonly provider?: string;
  readonly model?: string;
  readonly globalOptions?: GlobalOptions;
}

type TTEEvent =
  | { type: 'exit' }
  | { type: 'tte';      response: string; state: SharedState }
  | { type: 'tteError'; response: string; state: SharedState };

export async function startTUI(options: TUIOptions): Promise<void> {
  try {
    // Check TTE availability; attempt silent install if missing
    const tteOk = await checkTte();
    if (!tteOk) void autoInstallTte();

    const [{ render }, { createElement }, { App }] = await Promise.all([
      import('ink'),
      import('react'),
      import('./app.js'),
    ]);

    // Shared mutable state that persists across unmount/remount cycles
    const shared: SharedState = {
      messages: [],
      provider: options.provider,
      model: options.model,
      tokens: 0,
      ollamaEnabled: loadSettings().ollamaEnabled,
    };

    let shouldExit = false;

    while (!shouldExit) {
      const event = await new Promise<TTEEvent>(resolve => {
        const inst = render(
          createElement(App, {
            provider: options.provider,
            model: options.model,
            globalOptions: options.globalOptions,
            initialState: { ...shared },
            onTTERequest: (response: string, updatedState: SharedState) => {
              inst.unmount();
              resolve({ type: 'tte', response, state: updatedState });
            },
            onTTEError: (errorMsg: string, updatedState: SharedState) => {
              inst.unmount();
              resolve({ type: 'tteError', response: errorMsg, state: updatedState });
            },
            onExit: () => {
              inst.unmount();
              resolve({ type: 'exit' });
            },
          })
        );
      });

      if (event.type === 'exit') {
        shouldExit = true;
        continue;
      }

      // Update shared state for next cycle
      Object.assign(shared, event.state);

      if (event.type === 'tte') {
        await displayResponse(event.response);
      } else {
        // Error: print the error message header then animate with unstable
        process.stdout.write('\n\x1b[31m✗ error\x1b[0m\n');
        await display(event.response, 'unstable');
        process.stdout.write('\n');
      }
    }
  } catch {
    // Ink or TTE not available — fall back to REPL
    const { startREPL } = await import('../repl.js');
    await startREPL(options.globalOptions ?? {});
  }
}
