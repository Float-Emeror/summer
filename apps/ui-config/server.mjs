import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, 'ui-overrides.json');
const port = Number(process.env.UI_CONFIG_PORT ?? 4317);

const allowedOrigins = new Set([
  process.env.UI_CONFIG_CORS_ORIGIN,
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean));

function isAllowedLocalOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  const allowedOrigin = origin && (allowedOrigins.has(origin) || isAllowedLocalOrigin(origin)) ? origin : 'http://localhost:5173';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  };
}

async function readConfig() {
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

async function writeConfig(body) {
  const nextConfig = {
    version: 1,
    updatedAt: new Date().toISOString(),
    overrides: body?.overrides ?? {},
  };
  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  return nextConfig;
}

function sendJson(response, statusCode, payload) {
  const headers = response.req ? corsHeaders(response.req) : corsHeaders({ headers: {} });
  response.writeHead(statusCode, {
    ...headers,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }

  if (request.url !== '/ui-overrides') {
    sendJson(response, 404, { message: 'Not found' });
    return;
  }

  try {
    if (request.method === 'GET') {
      sendJson(response, 200, await readConfig());
      return;
    }

    if (request.method === 'PUT') {
      sendJson(response, 200, await writeConfig(await readBody(request)));
      return;
    }

    sendJson(response, 405, { message: 'Method not allowed' });
  } catch (error) {
    sendJson(response, 500, {
      message: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`UI config service failed: 127.0.0.1:${port} is already in use.`);
  } else {
    console.error('UI config service failed:', error);
  }
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`UI config service listening on http://localhost:${port}/ui-overrides`);
});
