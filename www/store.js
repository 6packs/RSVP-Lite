import { DEFAULT_PRESET, DEFAULT_WPM, PRESETS } from './rsvp.js'

// Settings are small and read at startup, so they live in localStorage.
// Books can be megabytes, so they live in IndexedDB: a `books` store of
// small records for the library list, and a `texts` store of full texts
// read only when a book is opened.

const DEFAULTS = {
  theme: 'dark', // 'dark' | 'light' | 'system'
  wpm: DEFAULT_WPM, // for books not started yet
  font: 'sans',
  size: 56,
  orpColor: '', // '' follows the theme's accent
  pacing: PRESETS[DEFAULT_PRESET].pacing,
}

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('settings')) ?? {}
  } catch {
    return {}
  }
})()

export const settings = { ...DEFAULTS, ...saved, pacing: { ...DEFAULTS.pacing, ...saved.pacing } }

export function save(changes) {
  Object.assign(settings, changes)
  localStorage.setItem('settings', JSON.stringify(settings))
}

const db = new Promise((resolve, reject) => {
  const open = indexedDB.open('rsvp-lite', 1)
  open.onupgradeneeded = () => {
    open.result.createObjectStore('books', { keyPath: 'id', autoIncrement: true })
    open.result.createObjectStore('texts')
  }
  open.onsuccess = () => resolve(open.result)
  open.onerror = () => reject(open.error)
})

async function run(stores, mode, work) {
  const tx = (await db).transaction(stores, mode)
  const request = work(...stores.map((s) => tx.objectStore(s)))
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(request?.result)
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
}

export const books = {
  list: () => run(['books'], 'readonly', (b) => b.getAll()),
  get: (id) => run(['books'], 'readonly', (b) => b.get(id)),
  text: (id) => run(['texts'], 'readonly', (t) => t.get(id)),
  update: (book) => run(['books'], 'readwrite', (b) => b.put(book)),
  remove: (id) => run(['books', 'texts'], 'readwrite', (b, t) => (b.delete(id), t.delete(id))),

  /** Stores a new book and its text together; resolves to its id. */
  add: (book, text) =>
    run(['books', 'texts'], 'readwrite', (b, t) => {
      const added = b.add(book)
      added.onsuccess = () => t.put(text, added.result)
      return added
    }),
}
