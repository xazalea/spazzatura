import { spawn } from 'child_process';

export async function runPythonEffect(effectName: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-m', 'terminaltexteffects', effectName], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`terminaltexteffects exited with code ${code}`));
      }
    });

    if (proc.stdin) {
      proc.stdin.write(text);
      proc.stdin.end();
    }
  });
}
