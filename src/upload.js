require('./common')
const template = require('./radarTemplate.json')

const TEMPLATE_FIELDS = Array.isArray(template) && template.length > 0 ? Object.keys(template[0]) : []

function setStatus(el, html) {
  el.innerHTML = html
}

const REQUIRED_FIELDS = TEMPLATE_FIELDS.length ? TEMPLATE_FIELDS : ['name', 'ring', 'quadrant', 'isNew', 'description']

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripWrappingQuotes(s) {
  const t = String(s).trim()
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }

    cur += ch
  }

  out.push(cur)
  return out
}

function validateCsvText(text) {
  const firstLine = String(text)
    .split(/\r?\n/)
    .find((l) => l.trim().length > 0)

  if (!firstLine) throw new Error('CSV is empty.')

  const headers = parseCsvLine(firstLine).map((h) => stripWrappingQuotes(h).trim())

  for (const field of REQUIRED_FIELDS) {
    if (!headers.includes(field)) {
      throw new Error(`CSV must include header "${field}". Required headers: ${REQUIRED_FIELDS.join(', ')}`)
    }
  }
}

function validateJsonText(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON is not valid JSON.')
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('JSON must be an array with at least one object.')
  }

  const keys = Object.keys(data[0] || {})
  for (const field of REQUIRED_FIELDS) {
    if (!keys.includes(field)) {
      throw new Error(`JSON objects must include "${field}". Required fields: ${REQUIRED_FIELDS.join(', ')}`)
    }
  }
}

async function validateRadarFile(file) {
  const name = file?.name || ''
  const lower = name.toLowerCase()

  if (!lower.endsWith('.csv') && !lower.endsWith('.json')) {
    throw new Error('File must end with .csv or .json (the app detects format by URL extension).')
  }

  const text = await file.text()
  if (lower.endsWith('.csv')) validateCsvText(text)
  if (lower.endsWith('.json')) validateJsonText(text)
}

async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file, file.name)

  const res = await fetch('/upload', { method: 'POST', body: form })
  const contentType = res.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const msg = typeof body === 'string' ? body : body?.error || 'Upload failed'
    throw new Error(msg)
  }

  return body
}

window.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('upload-form')
  const input = document.getElementById('upload-file')
  const status = document.getElementById('upload-status')

  if (!form || !input || !status) return

  form.addEventListener('submit', async function (e) {
    e.preventDefault()

    const file = input.files && input.files[0]
    if (!file) {
      setStatus(status, '<div class="upload-status upload-status--error"><p>Please choose a file first.</p></div>')
      return
    }

    try {
      await validateRadarFile(file)
    } catch (err) {
      setStatus(
        status,
        `<div class="upload-status upload-status--error"><p>${escapeHtml(
          String(err && err.message ? err.message : err)
        )}</p></div>`
      )
      return
    }

    setStatus(status, '<div class="upload-status"><p>Uploading…</p></div>')

    try {
      const result = await uploadFile(file)
      const relPath = result?.path || ''
      const href = relPath.startsWith('/') ? relPath : '/files/'
      setStatus(
        status,
        `<div class="upload-status upload-status--success">
           <div class="upload-status__icon" aria-hidden="true">✓</div>
           <div class="upload-status__body">
             <p class="upload-status__title">Uploaded successfully.</p>
           </div>
         </div>`
      )
      form.reset()
    } catch (err) {
      setStatus(
        status,
        `<div class="upload-status upload-status--error">
           <div class="upload-status__icon" aria-hidden="true">!</div>
           <div class="upload-status__body">
             <p class="upload-status__title">Upload failed.</p>
             <p>${escapeHtml(String(err && err.message ? err.message : err))}</p>
           </div>
         </div>`
      )
    }
  })
})
