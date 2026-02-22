import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';

const PORT = parseInt(process.env.PORT ?? '3002', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const ROUTES: Record<string, string> = {
  '/clob': 'https://clob.polymarket.com',
  '/relayer': 'https://relayer-v2.polymarket.com',
};

function log(method: string, path: string, status: number, durationMs: number): void {
  const ts = new Date().toISOString();
  console.log(`${ts} ${method} ${path} → ${status} (${durationMs}ms)`);
}

function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
}

function proxy(req: IncomingMessage, res: ServerResponse): void {
  const start = Date.now();
  const url = req.url ?? '/';

  // Health check
  if (url === '/health') {
    log(req.method ?? 'GET', url, 200, Date.now() - start);
    return handleHealth(req, res);
  }

  // IP check — returns this server's outbound IP for debugging geo issues
  if (url === '/ip') {
    const ipReq = httpsRequest('https://api.ipify.org?format=json', (ipRes) => {
      let body = '';
      ipRes.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      ipRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body);
        log(req.method ?? 'GET', url, 200, Date.now() - start);
      });
    });
    ipReq.on('error', () => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ip check failed' }));
    });
    ipReq.end();
    return;
  }

  // Find matching route prefix
  let targetOrigin: string | undefined;
  let stripped = '';

  for (const [prefix, origin] of Object.entries(ROUTES)) {
    if (url.startsWith(prefix + '/') || url === prefix) {
      targetOrigin = origin;
      stripped = url.slice(prefix.length) || '/';
      break;
    }
  }

  if (!targetOrigin) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    log(req.method ?? '?', url, 404, Date.now() - start);
    return;
  }

  const target = new URL(stripped, targetOrigin);

  // Forward headers, replacing host
  const headers: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (key === 'host' || key === 'connection') continue;
    if (val !== undefined) headers[key] = val;
  }
  headers['host'] = target.hostname;

  const proxyReq = httpsRequest(
    target,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      const status = proxyRes.statusCode ?? 502;
      res.writeHead(status, proxyRes.headers);
      proxyRes.pipe(res);
      log(req.method ?? '?', url, status, Date.now() - start);
    },
  );

  proxyReq.on('error', (err) => {
    console.error(`Proxy error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream error' }));
    }
    log(req.method ?? '?', url, 502, Date.now() - start);
  });

  req.pipe(proxyReq);
}

const server = createServer(proxy);

server.listen(PORT, HOST, () => {
  console.log(`poly-proxy listening on ${HOST}:${PORT}`);
  console.log('Routes:');
  for (const [prefix, origin] of Object.entries(ROUTES)) {
    console.log(`  ${prefix}/* → ${origin}/*`);
  }
});

function shutdown(): void {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
