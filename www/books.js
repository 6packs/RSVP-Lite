// Files in, plain text out: paragraphs separated by blank lines.

export const ACCEPT = '.txt,.text,.md,.markdown,.epub,.pdf'

/** Reads a dropped or picked file into `{ title, text }`. */
export async function readBook(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const data = await file.arrayBuffer()
  const book =
    ext === 'epub' ? await readEpub(data)
    : ext === 'pdf' ? await readPdf(data)
    : { text: ext.startsWith('m') ? stripMarkdown(decode(data)) : decode(data) }
  if (!/\p{L}/u.test(book.text)) throw new Error('There are no readable words in this file.')
  return { title: book.title || titleFrom(file.name), text: book.text }
}

const titleFrom = (name) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

/** UTF-8, or Windows-1254 for old files that aren't (it covers Turkish). */
function decode(data) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    return new TextDecoder('windows-1254').decode(data)
  }
}

/** Just enough Markdown removal that `#`, `**` and `[]()` aren't read as words. */
export const stripMarkdown = (md) =>
  md
    .replace(/^(```|~~~).*$/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, '') // --- rules
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // headings, quotes, lists
    .replace(/(\*\*\*|___|\*\*|__|\*|_|~~)(\S.*?)\1/g, '$2')

// --- EPUB: a zip of XHTML chapters, listed in reading order by the OPF ---

/** A minimal zip reader: stored and deflated entries, which is all EPUBs use. */
export function unzip(data) {
  const view = new DataView(data)
  const bytes = new Uint8Array(data)
  let end = data.byteLength - 22
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0) throw new Error('This file is damaged (it isn’t a valid zip).')

  const entries = new Map()
  for (let n = view.getUint16(end + 10, true), p = view.getUint32(end + 16, true); n--; ) {
    const nameLength = view.getUint16(p + 28, true)
    entries.set(new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength)), {
      method: view.getUint16(p + 10, true),
      size: view.getUint32(p + 20, true),
      offset: view.getUint32(p + 42, true),
    })
    p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true)
  }

  /** The named file's text, or null if there's no such file. */
  return async (name) => {
    const entry = entries.get(name)
    if (!entry) return null
    const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true)
    const raw = new Blob([bytes.subarray(start, start + entry.size)])
    const stream = entry.method === 8 ? raw.stream().pipeThrough(new DecompressionStream('deflate-raw')) : raw.stream()
    return new Response(stream).text()
  }
}

const xml = (text) => new DOMParser().parseFromString(text, 'application/xml')

/** `base` + a relative href, with `..` resolved and any #fragment dropped. */
function resolve(base, href) {
  const path = []
  for (const part of (base + decodeURIComponent(href.split('#')[0])).split('/'))
    if (part === '..') path.pop()
    else if (part && part !== '.') path.push(part)
  return path.join('/')
}

const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd'

async function readEpub(data) {
  const read = unzip(data)
  const container = await read('META-INF/container.xml')
  const opfPath = container && xml(container).querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath) throw new Error('This EPUB is damaged (it has no table of contents).')
  const opf = xml(await read(opfPath))
  const base = opfPath.includes('/') ? opfPath.replace(/[^/]+$/, '') : ''
  const manifest = new Map([...opf.querySelectorAll('manifest > item')].map((i) => [i.id, i.getAttribute('href')]))

  const paragraphs = []
  for (const ref of opf.querySelectorAll('spine > itemref:not([linear="no"])')) {
    const href = manifest.get(ref.getAttribute('idref'))
    const html = href && (await read(resolve(base, href)))
    if (!html) continue
    const body = new DOMParser().parseFromString(html, 'text/html').body
    // Footnote markers like [12] would flash up as words.
    for (const a of body.querySelectorAll('a')) if (/^\[?\s*\d+\s*\]?$/.test(a.textContent.trim())) a.remove()
    for (const block of body.querySelectorAll(BLOCKS)) {
      if (block.closest('nav') || block.querySelector(BLOCKS)) continue // the innermost block holds the text
      const text = block.textContent.replace(/\s+/g, ' ').trim()
      if (text) paragraphs.push(text)
    }
  }
  const title = opf.getElementsByTagNameNS('*', 'title')[0]?.textContent.trim()
  return { title, text: paragraphs.join('\n\n') }
}

// --- PDF: positioned runs of text, which we put back into lines and paragraphs ---

async function readPdf(data) {
  const pdfjs = await import('./vendor/pdf.min.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href
  let pdf
  try {
    pdf = await pdfjs.getDocument({ data }).promise
  } catch (e) {
    throw new Error(e.name === 'PasswordException' ? 'This PDF is password-protected.' : 'This PDF couldn’t be opened.')
  }

  const lines = [] // { text, y, page }
  for (let page = 1; page <= pdf.numPages; page++) {
    let line = null
    for (const item of (await (await pdf.getPage(page)).getTextContent()).items) {
      const [scale, , , , x, y] = item.transform
      line ??= { text: '', y, page, end: x }
      // Runs that touch are one word split by a style change; a visible gap is a space.
      const gap = x - line.end > 0.15 * (Math.abs(scale) || item.height || 1)
      if (gap && !/\s$/.test(line.text) && !/^\s/.test(item.str)) line.text += ' '
      line.text += item.str
      line.end = x + item.width
      if (item.hasEOL) {
        if (line.text.trim()) lines.push({ text: line.text.trim(), y: line.y, page })
        line = null
      }
    }
    if (line?.text.trim()) lines.push({ text: line.text.trim(), y: line.y, page })
  }

  // Running headers, footers and page numbers repeat page after page.
  const key = (line) => line.text.replace(/\d+/g, '#')
  const pagesWith = new Map()
  for (const line of lines) {
    if (!pagesWith.has(key(line))) pagesWith.set(key(line), new Set())
    pagesWith.get(key(line)).add(line.page)
  }
  const repeats = (line) => pagesWith.get(key(line)).size >= Math.max(3, pdf.numPages / 2) || /^\W*\d+\W*$/.test(line.text)
  const body = lines.filter((line) => !repeats(line))
  if (!body.some((line) => /\p{L}/u.test(line.text)))
    throw new Error('This PDF has no text to read — it’s probably scanned images.')

  // A paragraph ends where the gap to the next line is noticeably bigger
  // than usual — or, at a page or column turn, where a sentence ended.
  const gaps = body.slice(1).map((line, i) => body[i].y - line.y).filter((g) => g > 0).sort((a, b) => a - b)
  const usual = gaps[Math.floor(gaps.length / 2)] ?? 14
  let text = ''
  body.forEach((line, i) => {
    const next = body[i + 1]
    const turn = next && (next.page !== line.page || next.y >= line.y)
    const breaks = !next || (turn ? /[.!?…]["'’”»)]*$/.test(line.text) : line.y - next.y > usual * 1.35)
    text += line.text + (breaks ? '\n\n' : '\n')
  })
  const title = (await pdf.getMetadata()).info?.Title?.trim()
  return { title, text }
}
