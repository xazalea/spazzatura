/**
 * Service Manager — starts and manages the vendor AI proxy services.
 * Each service is a Node.js server exposing OpenAI-compatible endpoints.
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const VENDOR_DIR = join(import.meta.dirname ?? __dirname, '../../../../../vendor');
const LOGS_DIR = join(homedir(), '.spazzatura', 'logs');

export interface ServiceDef {
  name: string;
  dir: string;
  port: number;
  /** Headers to inject into provider requests (e.g. authorization token) */
  authHeader?: string;
  buildCmd?: string;
  startCmd: string;
  healthPath?: string;
  /** 'node' (default) or 'python' — changes install/build strategy */
  runtime?: 'node' | 'python';
}

/** All configured AI proxy services */
export const SERVICES: ServiceDef[] = [
  // LLM-Red-Team services — OpenAI-compatible, need auth tokens injected via env
  {
    name: 'qwen-free-api',
    dir: join(VENDOR_DIR, 'qwen-free-api'),
    port: 3045,
    buildCmd: 'npm run build',
    startCmd: 'node dist/index.js',
    healthPath: '/v1/models',
  },
  {
    name: 'glm-free-api',
    dir: join(VENDOR_DIR, 'glm-free-api'),
    port: 3046,
    buildCmd: 'npm run build',
    startCmd: 'node dist/index.js',
    healthPath: '/v1/models',
  },
  {
    name: 'minimax-free-api',
    dir: join(VENDOR_DIR, 'minimax-free-api'),
    port: 3047,
    buildCmd: 'npm run build',
    startCmd: 'node dist/index.js',
    healthPath: '/v1/models',
  },
  // FreeGLM — proxy to open.bigmodel.cn
  {
    name: 'freeglm',
    dir: join(VENDOR_DIR, 'freeglm'),
    port: 33333,
    startCmd: 'node server.js',
    healthPath: '/',
  },
  // AIClient-2-API — multi-service OpenAI-compatible proxy (port 3048)
  {
    name: 'aiclient-api',
    dir: join(VENDOR_DIR, 'aiclient-api'),
    port: 3048,
    buildCmd: 'npm run build',
    startCmd: 'node dist/index.js',
    healthPath: '/v1/models',
  },
  // GLM-Free-API (xiaoY) — GLM web session proxy (port 3049)
  {
    name: 'glm-free-xiaoY',
    dir: join(VENDOR_DIR, 'glm-free-xiaoY'),
    port: 3049,
    buildCmd: 'npm run build',
    startCmd: 'node dist/index.js',
    healthPath: '/v1/models',
  },
  // gpt4free-ts — TypeScript gpt4free server (port 3051)
  {
    name: 'gpt4free-ts',
    dir: join(VENDOR_DIR, 'gpt4free-ts'),
    port: 3051,
    buildCmd: 'npm run build',
    startCmd: 'node dist/index.js',
    healthPath: '/v1/models',
  },
  // Free-GPT4-WEB-API — Python Flask proxy for GPT-4 (port 3050)
  {
    name: 'free-gpt4-web',
    dir: join(VENDOR_DIR, 'free-gpt4-web'),
    port: 3050,
    buildCmd: 'pip install -r requirements.txt -q',
    startCmd: 'python FreeGPT4.py',
    healthPath: '/',
    runtime: 'python',
  },
];

const runningProcesses = new Map<string, ChildProcess>();

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
}

function serviceExists(svc: ServiceDef): boolean {
  if (!existsSync(svc.dir)) return false;
  if (svc.runtime === 'python') return existsSync(join(svc.dir, 'requirements.txt')) || existsSync(join(svc.dir, 'setup.py'));
  return existsSync(join(svc.dir, 'package.json'));
}

function isBuilt(svc: ServiceDef): boolean {
  if (svc.runtime === 'python') return true; // Python: no build step needed
  return existsSync(join(svc.dir, 'dist', 'index.js'));
}

/** Write a custom service.yml with the assigned port */
function configurePort(svc: ServiceDef): void {
  const configDir = join(svc.dir, 'configs', 'dev');
  if (!existsSync(configDir)) return;
  const configPath = join(configDir, 'service.yml');
  try {
    let content = readFileSync(configPath, 'utf-8');
    // Replace the port line
    content = content.replace(/^port:\s*\d+/m, `port: ${svc.port}`);
    writeFileSync(configPath, content, 'utf-8');
  } catch { /* ignore */ }
}

async function buildService(svc: ServiceDef): Promise<boolean> {
  if (!svc.buildCmd || svc.runtime === 'python') return true;
  if (isBuilt(svc)) return true;

  return new Promise(resolve => {
    const [cmd, ...args] = svc.buildCmd!.split(' ');
    const proc = spawn(cmd!, args, {
      cwd: svc.dir,
      stdio: 'pipe',
      shell: true,
    });
    proc.on('close', code => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function waitForHealth(svc: ServiceDef, timeoutMs = 30000): Promise<boolean> {
  const url = `http://localhost:${svc.port}${svc.healthPath ?? '/'}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status === 401 || res.status === 404) return true;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

export interface StartResult {
  service: string;
  port: number;
  success: boolean;
  error?: string;
}

export async function startService(svc: ServiceDef): Promise<StartResult> {
  if (!serviceExists(svc)) {
    return { service: svc.name, port: svc.port, success: false, error: 'Not installed' };
  }

  configurePort(svc);

  // Install deps
  if (svc.runtime === 'python') {
    // Python: install requirements if not done (check for venv or site-packages marker)
    if (!existsSync(join(svc.dir, '.deps-installed')) && existsSync(join(svc.dir, 'requirements.txt'))) {
      await new Promise<void>(resolve => {
        const proc = spawn('pip', ['install', '-r', 'requirements.txt', '-q'], {
          cwd: svc.dir, stdio: 'ignore', shell: true,
        });
        proc.on('close', () => {
          try { writeFileSync(join(svc.dir, '.deps-installed'), '1'); } catch { /* ignore */ }
          resolve();
        });
        proc.on('error', () => resolve());
      });
    }
  } else if (!existsSync(join(svc.dir, 'node_modules'))) {
    await new Promise<void>(resolve => {
      const proc = spawn('npm', ['install', '--prefer-offline'], {
        cwd: svc.dir,
        stdio: 'ignore',
        shell: true,
      });
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });
  }

  // Build
  const built = await buildService(svc);
  if (!built) {
    return { service: svc.name, port: svc.port, success: false, error: 'Build failed' };
  }

  // Start
  ensureLogsDir();
  const logFile = join(LOGS_DIR, svc.name + '.log');
  const [cmd, ...args] = svc.startCmd.split(' ');

  const proc = spawn(cmd!, args, {
    cwd: svc.dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, PORT: String(svc.port), NODE_ENV: 'production' },
    detached: false,
  });

  // Pipe output to log file
  const { createWriteStream } = await import('fs');
  const logStream = createWriteStream(logFile, { flags: 'a' });
  proc.stdout?.pipe(logStream);
  proc.stderr?.pipe(logStream);

  runningProcesses.set(svc.name, proc);

  // Wait for health
  const healthy = await waitForHealth(svc, 25000);

  if (!healthy) {
    proc.kill();
    return { service: svc.name, port: svc.port, success: false, error: 'Health check timeout' };
  }

  return { service: svc.name, port: svc.port, success: true };
}

export async function startAllServices(
  onProgress?: (result: StartResult) => void
): Promise<StartResult[]> {
  const results: StartResult[] = [];

  for (const svc of SERVICES) {
    const result = await startService(svc);
    results.push(result);
    onProgress?.(result);
  }

  return results;
}

export function stopAllServices(): void {
  for (const [, proc] of runningProcesses) {
    try { proc.kill('SIGTERM'); } catch { /* ignore */ }
  }
  runningProcesses.clear();
}

/** Register cleanup on process exit */
export function registerCleanup(): void {
  const cleanup = () => { stopAllServices(); };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

/** Get port for a named service */
export function getServicePort(name: string): number | undefined {
  return SERVICES.find(s => s.name === name)?.port;
}
