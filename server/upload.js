#!/usr/bin/env node
/**
 * Minimal upload server for /upload API.
 * Saves files to the same directory nginx serves at /files/ and runs chmod 655.
 * Expects to run with cwd = app root (e.g. /opt/build-your-own-radar); uses ./files.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

const FILES_DIR = process.env.FILES_DIR
  ? path.resolve(process.env.FILES_DIR)
  : path.resolve(process.cwd(), 'files');
const PORT = Number(process.env.UPLOAD_PORT) || 3000;
const HOST = process.env.UPLOAD_HOST || '127.0.0.1';
const UPLOAD_MODE = 0o655; // chmod 655 = rw-r-xr-x

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTimestampYYYYMMDDHHmm(date) {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${yyyy}${mm}${dd}${hh}${min}`;
}

function sanitizeBaseName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildTimestampedName(originalFilename) {
  const parsed = path.parse(path.basename(originalFilename));
  const base = sanitizeBaseName(parsed.name || 'upload') || 'upload';
  const ext = sanitizeBaseName(parsed.ext || '');
  const ts = formatTimestampYYYYMMDDHHmm(new Date());
  return `${base}_${ts}${ext}`;
}

function uniqueNameInDir(dir, candidate) {
  const parsed = path.parse(candidate);
  let name = candidate;
  let counter = 2;
  while (fs.existsSync(path.join(dir, name))) {
    name = `${parsed.name}_${counter}${parsed.ext}`;
    counter += 1;
  }
  return name;
}

function send(res, statusCode, body, contentType = 'application/json') {
  res.writeHead(statusCode, { 'Content-Type': contentType, ...CORS_HEADERS });
  res.end(body);
}

function sendJson(res, statusCode, obj) {
  send(res, statusCode, JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/upload') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    sendJson(res, 400, { error: 'Content-Type must be multipart/form-data' });
    return;
  }

  const boundary = contentType.split('boundary=')[1]?.trim()?.replace(/^["']|["']$/g, '');
  if (!boundary) {
    sendJson(res, 400, { error: 'Missing boundary in Content-Type' });
    return;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks);
  const parts = parseMultipart(raw, boundary);
  const filePart = parts.find((p) => p.name === 'file' && p.filename);
  if (!filePart) {
    sendJson(res, 400, { error: 'Missing file field (multipart field name must be "file")' });
    return;
  }

  try {
    if (!fs.existsSync(FILES_DIR)) {
      fs.mkdirSync(FILES_DIR, { recursive: true });
    }
    const candidateName = buildTimestampedName(filePart.filename);
    const safeName = uniqueNameInDir(FILES_DIR, candidateName);
    const filePath = path.join(FILES_DIR, safeName);
    fs.writeFileSync(filePath, filePart.data);
    fs.chmodSync(filePath, UPLOAD_MODE);
    sendJson(res, 200, { ok: true, path: `/files/${safeName}` });
  } catch (err) {
    console.error('Upload error:', err);
    sendJson(res, 500, { error: 'Failed to save file' });
  }
});

function parseMultipart(buffer, boundary) {
  const parts = [];
  const sep = Buffer.from(`--${boundary}`, 'utf8');
  const endSep = Buffer.from(`--${boundary}--`, 'utf8');
  let start = buffer.indexOf(sep) + sep.length;
  while (start < buffer.length) {
    const next = buffer.indexOf(sep, start);
    const end = next === -1 ? buffer.indexOf(endSep, start) : next;
    if (end === -1) break;
    const block = buffer.subarray(start, end);
    const headerEnd = block.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      start = end + (next === -1 ? endSep.length : sep.length);
      continue;
    }
    const headers = block.subarray(0, headerEnd).toString('utf8');
    const body = block.subarray(headerEnd + 4);
    const m = headers.match(/Content-Disposition:[^;]*;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    if (m) {
      parts.push({
        name: m[1],
        filename: m[2] || null,
        data: body,
      });
    }
    start = end + (next === -1 ? endSep.length : sep.length);
  }
  return parts;
}

server.listen(PORT, HOST, () => {
  console.error(`Upload server listening on http://${HOST}:${PORT} (files dir: ${FILES_DIR})`);
});
