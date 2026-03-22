/**
 * TUI entry point — ink-based React terminal interface
 */

import type { GlobalOptions } from '../index.js';

export interface TUIOptions {
  readonly provider?: string;
  readonly model?: string;
  readonly globalOptions: GlobalOptions;
}

/**
 * Start the ink TUI. Falls back to REPL if ink is unavailable.
 */
export async function startTUI(options: TUIOptions): Promise<void> {
  try {
    // Dynamic import so this can't fail the module load
    const [{ render }, { createElement }, { App }] = await Promise.all([
      import('ink'),
      import('react'),
      import('./app.js'),
    ]);

    const { waitUntilExit } = render(
      createElement(App, {
        provider: options.provider,
        model: options.model,
        globalOptions: options.globalOptions,
      })
    );

    await waitUntilExit();
  } catch {
    // ink not available — fall back to REPL
    const { startREPL } = await import('../repl.js');
    await startREPL(options.globalOptions);
  }
}
