require('./common')
require('./images/logo.png')
require('./images/radar_legend.png')
require('./analytics.js')

const Factory = require('./util/factory')
const QueryParams = require('./util/queryParamProcessor')

async function redirectToLatestIfNeeded() {
  try {
    const query = QueryParams(window.location.search.substring(1))
    if (query.noLatest === '1' || query.documentId || query.sheetId) {
      return
    }

    const res = await fetch('/files/latest.json', { method: 'GET' })
    if (!res.ok) return
    const data = await res.json().catch(() => null)
    const target = data && data.path
    if (!target) return

    const url = new URL(window.location.href)
    url.searchParams.set('documentId', `${window.location.origin}${target}`)
    url.searchParams.set('latest', '1')
    window.location.replace(url.toString())
  } catch {
    // best-effort only; ignore failures and fall back to normal flow
  }
}

redirectToLatestIfNeeded().then(() => {
  Factory().build()
})
