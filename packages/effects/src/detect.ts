import { spawn } from 'child_process';

export async function checkPython(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('python3', ['-m', 'terminaltexteffects', '--version'], {
      stdio: 'ignore',
    });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

export async function installFromVendor(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('pip', ['install', '-e', '../../vendor/terminaltexteffects'], {
      stdio: 'inherit',
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pip install exited with code ${code}`));
      }
    });
  });
}

export async function ensurePython(): Promise<boolean> {
  if (await checkPython()) {
    return true;
  }
  try {
    await installFromVendor();
  } catch {
    return false;
  }
  return checkPython();
}
