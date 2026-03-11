const d3 = require('d3')

const config = require('../../config')
const { addPdfCoverTitle } = require('../pdfPage')
const { getDocumentOrSheetId } = require('../../util/urlUtils')
const featureToggles = config().featureToggles

function safeDecodeURIComponent(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function fileNameFromUrl(urlLike) {
  if (!urlLike) return ''

  const raw = String(urlLike)

  try {
    const u = new URL(raw, window.location.origin)
    const path = u.pathname || ''
    const last = path.split('/').filter(Boolean).pop() || raw
    return safeDecodeURIComponent(last)
  } catch {
    const path = raw.split('?')[0]
    const last = path.split('/').filter(Boolean).pop() || raw
    return safeDecodeURIComponent(last)
  }
}

function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let val = n / 1024
  let i = 0
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  const rounded = val >= 10 ? Math.round(val) : Math.round(val * 10) / 10
  return `${rounded} ${units[i]}`
}

function isLatestContext() {
  try {
    const params = new URLSearchParams(window.location.search.substring(1))
    return params.get('latest') === '1'
  } catch {
    return false
  }
}

async function buildSourceMetadataText(sourceUrl) {
  if (!sourceUrl) return ''

  // When coming from latest.json, prefer the uploadedAt metadata
  if (isLatestContext()) {
    try {
      const res = await fetch('/files/latest.json', { method: 'GET' })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        const uploadedAt = data && data.uploadedAt
        if (uploadedAt) {
          const d = new Date(uploadedAt)
          const label = Number.isNaN(d.getTime()) ? uploadedAt : d.toLocaleString()
          return `Latest upload: ${label}`
        }
      }
    } catch {
      // fall through to best-effort HEAD request below
    }
  }

  const fileName = fileNameFromUrl(sourceUrl)
  const lastModified = ''

  // Best-effort metadata (works for same-origin /files/ via nginx; may be blocked by CORS elsewhere)
  try {
    const res = await fetch(sourceUrl, { method: 'HEAD' })
    const lm = res.headers.get('last-modified')

    const parts = []
    if (lm) {
      const d = new Date(lm)
      parts.push(`File Updated: ${Number.isNaN(d.getTime()) ? lm : d.toLocaleString()}`)
    }

    return parts.length ? `${parts.join(' • ')}` : lastModified
  } catch {
    return lastModified
  }
}

function renderBanner(renderFullRadar) {
  if (featureToggles.UIRefresh2022) {
    const documentTitle = document.title[0].toUpperCase() + document.title.slice(1)

    document.title = documentTitle
    const wrapper = d3.select('.hero-banner__wrapper')
    wrapper.append('p').classed('hero-banner__subtitle-text', true).text(document.title)

    const sourceEl = wrapper.append('p').classed('hero-banner__source-text', true).text('')
    const sourceUrl = getDocumentOrSheetId()
    buildSourceMetadataText(sourceUrl).then((t) => {
      if (t) sourceEl.text(t)
    })

    d3.select('.hero-banner__title-text').on('click', renderFullRadar)

    addPdfCoverTitle(documentTitle)
  } else {
    const header = d3.select('body').insert('header', '#radar')
    header
      .append('div')
      .attr('class', 'radar-title')
      .append('div')
      .attr('class', 'radar-title__text')
      .append('h1')
      .text(document.title)
      .style('cursor', 'pointer')
      .on('click', renderFullRadar)

    header
      .select('.radar-title')
      .append('div')
      .attr('class', 'radar-title__logo')
      .html('<a href="https://www.thoughtworks.com"> <img src="/images/logo.png" /> </a>')
  }
}

module.exports = {
  renderBanner,
}
