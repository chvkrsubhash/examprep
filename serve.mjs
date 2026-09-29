import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import authConfigHandler from './api/auth-config.js';
import uploadRoughWorkHandler from './api/upload-rough-work.js';

const root = process.cwd();
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  const lines = readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };

function decorateResponse(response) {
  response.status = function(code) {
    this.statusCode = code;
    return this;
  };
  response.json = function(data) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(data));
    return this;
  };
}

createServer(async (request, response) => {
  decorateResponse(response);
  const urlPath = request.url.split('?')[0];

  if (urlPath === '/api/auth-config') {
    return authConfigHandler(request, response);
  }

  if (urlPath === '/api/upload-rough-work') {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        request.body = raw ? JSON.parse(raw) : {};
      } catch {
        request.body = {};
      }
      await uploadRoughWorkHandler(request, response);
    });
    return;
  }

  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const file = normalize(join(root, requested));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8`,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  createReadStream(file).pipe(response);
}).listen(4173, () => console.log('Exam Prep running at http://localhost:4173'));

