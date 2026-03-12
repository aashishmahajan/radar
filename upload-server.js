#!/usr/bin/env node

/* Simple upload server for build-your-own-radar.
 *
 * - Accepts POST /upload with multipart/form-data field "file"
 * - Saves files into /opt/build-your-own-radar/files
 * - Writes/updates /opt/build-your-own-radar/files/latest.json containing:
 *     { "path": "/files/<uploaded-name>", "uploadedAt": "<ISO Timestamp>" }
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const BOUNDARY_RE = /boundary=([^;]+)/i
const UPLOAD_DIR = '/opt/build-your-own-radar/files'
const LATEST_PATH = path.join(UPLOAD_DIR, 'latest.json')

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function parseMultipart(headers, bodyBuffer) {
  const contentType = headers['content-type'] || headers['Content-Type'] || ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data')
  }
  const match = BOUNDARY_RE.exec(contentType)
  if (!match) {
    throw new Error('Missing multipart boundary')
  }
  const boundary = '--' + match[1]
  const parts = String(bodyBuffer).split(boundary).slice(1, -1)

  for (const part of parts) {
    const [rawHeaders, rawContent] = part.split('\r\n\r\n')
    if (!rawHeaders || !rawContent) continue

    const dispositionLine = rawHeaders.split('\r\n').find((l) => l.toLowerCase().startsWith('content-disposition'))
    if (!dispositionLine) continue

    const nameMatch = /name="([^"]+)"/i.exec(dispositionLine)
    if (!nameMatch || nameMatch[1] !== 'file') continue

    const fileNameMatch = /filename="([^"]*)"/i.exec(dispositionLine)
    const filename = fileNameMatch ? fileNameMatch[1] : ''
    const trimmedContent = rawContent.replace(/\r\n--?$/, '')
    return {
      filename: path.basename(filename || `upload-${Date.now()}`),
      buffer: Buffer.from(trimmedContent, 'binary'),
    }
  }

  throw new Error('No file field named "file" found in upload')
}

function handleUpload(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method Not Allowed')
    return
  }

  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    try {
      const body = Buffer.concat(chunks)
      const { filename, buffer } = parseMultipart(req.headers, body)

      if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true })
      }

      const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_') || `upload-${Date.now()}`
      const targetPath = path.join(UPLOAD_DIR, safeName)
      fs.writeFileSync(targetPath, buffer)

      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
      const uploadedAt = new Date().toISOString()
      const relPath = `/files/${safeName}`
      const latestPayload = {
        path: relPath,
        uploadedAt,
        sha256,
        filename: safeName,
      }
      fs.writeFileSync(LATEST_PATH, JSON.stringify(latestPayload, null, 2))

      // 201 Created with details about stored file
      sendJson(res, 201, latestPayload)
    } catch (err) {
      console.error('Upload failed:', err && err.stack ? err.stack : err)
      sendJson(res, 400, { error: err && err.message ? err.message : 'Upload failed' })
    }
  })
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.url === '/upload') {
    handleUpload(req, res)
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
})

const port = process.env.UPLOAD_PORT || 3000
server.listen(port, () => {
  console.log(`Upload server listening on port ${port}`)
})

