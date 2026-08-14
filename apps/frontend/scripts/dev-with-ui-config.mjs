import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');
const frontendDir = resolve(rootDir, 'frontend');
const uiConfigDir = resolve(rootDir, 'ui-config');
const viteBin = resolve(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');

async function canReuseUiConfigService() {
  return new Promise((resolveReuse) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port: Number(process.env.UI_CONFIG_PORT ?? 4317),
        path: '/ui-overrides',
        method: 'GET',
        timeout: 1000,
      },
      (response) => {
        resolveReuse((response.statusCode ?? 500) < 500);
        response.resume();
      },
    );

    req.on('error', () => resolveReuse(false));
    req.on('timeout', () => {
      req.destroy();
      resolveReuse(false);
    });
    req.end();
  });
}

const children = [];

if (await canReuseUiConfigService()) {
  console.log('[frontend dev] reuse existing ui-config service on http://localhost:4317/ui-overrides');
} else {
  children.push({
    name: 'ui-config',
    child: spawn(process.execPath, ['server.mjs'], {
      cwd: uiConfigDir,
      shell: false,
      stdio: 'inherit',
    }),
  });
}

children.push({
  name: 'vite',
  child: spawn(process.execPath, [viteBin, '--host', '0.0.0.0', '--port', '5173'], {
    cwd: frontendDir,
    shell: false,
    stdio: 'inherit',
  }),
});

function stopAll(signal) {
  for (const { child } of children) {
    if (child.killed || child.exitCode !== null) continue;
    child.kill(signal);
  }
}

process.on('SIGINT', () => {
  stopAll('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
  process.exit(0);
});

for (const { name, child } of children) {
  child.on('error', (error) => {
    console.error(`[frontend dev] failed to start ${name}:`, error);
    stopAll('SIGTERM');
    process.exitCode = 1;
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[frontend dev] ${name} exited with code ${code}.`);
      stopAll('SIGTERM');
      process.exit(code);
    }
  });
}
