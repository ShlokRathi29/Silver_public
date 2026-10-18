import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

const root = process.cwd()
const env = { ...loadEnv('production', root, ''), ...process.env }
const siteOriginValue = env.VITE_SITE_URL?.trim() ?? ''
const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
const outputDirectory = resolve(root, 'dist')

function parseSiteOrigin(value) {
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null
    return parsed.origin
  } catch {
    return null
  }
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

async function fetchSlugs(table) {
  const values = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL(`/rest/v1/${table}`, supabaseUrl)
    endpoint.searchParams.set('select', 'slug')
    endpoint.searchParams.set('status', 'eq.published')
    endpoint.searchParams.set('order', 'slug.asc')
    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Range-Unit': 'items',
        Range: `${offset}-${offset + pageSize - 1}`,
      },
    })
    if (!response.ok) throw new Error(`Sitemap data request failed for ${table} (HTTP ${response.status}).`)
    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error(`Sitemap data response for ${table} was not a list.`)
    for (const row of rows) {
      if (typeof row?.slug === 'string' && row.slug.trim()) values.push(row.slug.trim())
    }
    if (rows.length < pageSize) return values
  }
}

await mkdir(outputDirectory, { recursive: true })
const siteOrigin = parseSiteOrigin(siteOriginValue)
let sitemapAvailable = false

if (!siteOrigin) {
  console.info('Sitemap skipped: set VITE_SITE_URL to the public site origin.')
} else if (!supabaseUrl || !anonKey) {
  console.info('Sitemap skipped: public Supabase configuration is incomplete.')
} else {
  const [creatorSlugs, productSlugs] = await Promise.all([fetchSlugs('creators'), fetchSlugs('products')])
  const urls = [
    `${siteOrigin}/`,
    `${siteOrigin}/search`,
    `${siteOrigin}/creators`,
    `${siteOrigin}/products`,
    ...creatorSlugs.map((slug) => `${siteOrigin}/creators/${encodeURIComponent(slug)}`),
    ...productSlugs.map((slug) => `${siteOrigin}/products/${encodeURIComponent(slug)}`),
  ]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`
  await writeFile(resolve(outputDirectory, 'sitemap.xml'), sitemap, 'utf8')
  sitemapAvailable = true
  console.info(`Generated sitemap with ${urls.length} URLs.`)
}

const robotsLines = ['User-agent: *', 'Allow: /']
if (sitemapAvailable) robotsLines.push(`Sitemap: ${siteOrigin}/sitemap.xml`)
await writeFile(resolve(outputDirectory, 'robots.txt'), `${robotsLines.join('\n')}\n`, 'utf8')
