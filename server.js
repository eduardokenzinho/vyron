const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number(process.env.PORT) || 3000;

const apiHandlers = {
  '/api/address': require('./api/address'),
  '/api/create-pix': require('./api/create-pix'),
  '/api/payment-status': require('./api/payment-status'),
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
  };

  return types[extension] || 'application/octet-stream';
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Payload muito grande.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });

    req.on('error', reject);
  });
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendJson(res, 404, { error: 'Arquivo não encontrado.' });
        return;
      }

      sendJson(res, 500, { error: 'Erro ao carregar o arquivo solicitado.' });
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', getMimeType(filePath));
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };

  res.json = function json(payload) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(payload));
    return this;
  };

  if (pathname.startsWith('/api/')) {
    const apiHandler = apiHandlers[pathname];
    if (!apiHandler) {
      sendJson(res, 404, { error: 'Rota não encontrada.' });
      return;
    }

    req.query = Object.fromEntries(url.searchParams.entries());
    req.body = {};

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        req.body = await parseRequestBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Requisição inválida.' });
        return;
      }
    }

    try {
      await apiHandler(req, res);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message || 'Erro interno do servidor.',
      });
    }
    return;
  }

  const candidatePath = pathname === '/' ? path.join(rootDir, 'index.html') : path.join(rootDir, pathname);
  const isSafePath = candidatePath.startsWith(rootDir);

  if (!isSafePath) {
    sendJson(res, 403, { error: 'Acesso negado.' });
    return;
  }

  fs.stat(candidatePath, (error, stats) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendJson(res, 404, { error: 'Página não encontrada.' });
        return;
      }
      sendJson(res, 500, { error: 'Erro ao acessar o arquivo.' });
      return;
    }

    if (stats.isDirectory()) {
      serveStaticFile(res, path.join(candidatePath, 'index.html'));
      return;
    }

    serveStaticFile(res, candidatePath);
  });
});

server.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
