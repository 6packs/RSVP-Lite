// Text in, timed words out. No DOM here, so Node can test it as-is.

export const MIN_WPM = 50
export const MAX_WPM = 1500
export const DEFAULT_WPM = 250 // RSVP comprehension matches normal reading up to about here

/** Words with the paragraph each belongs to. A blank line starts a new
 * paragraph, a single newline is just a wrap, and a word hyphenated across
 * a line break is put back together. */
export function tokenize(text) {
  const words = []
  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '')
    .replace(/(?<=[\p{L}\p{N}])[-‐‑]\n(?=\p{Ll})/gu, '')
    .split(/\n\s*\n/)
  for (const p of paragraphs) {
    const para = words.length ? words.at(-1).para + 1 : 0
    for (const text of p.split(/\s+/)) if (text) words.push({ text, para })
  }
  return words
}

const letters = (s) => [...s]
const isLetter = (ch) => /\p{L}/u.test(ch)
const isUpper = (ch) => ch !== ch.toLowerCase() && ch === ch.toUpperCase()

/** The word without the punctuation and quotes around it. */
export const core = (word) => word.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')

/** Which letter to fix the eye on: the 1st of 1, the 2nd of 2–5, the 3rd
 * of 6–9, the 4th of 10–13, else the 5th — counting from the first letter,
 * not from a leading quote. */
export function orp(word) {
  const chars = letters(word)
  let start = 0
  while (start < chars.length - 1 && !/[\p{L}\p{N}]/u.test(chars[start])) start++
  const rest = chars.slice(start).join('')
  const n = letters(core(rest) || rest).length
  const offset = n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4
  return Math.min(start + offset, chars.length - 1)
}

const CLOSERS = /["'’”»)\]}*_]+$/u
const SHORT_PAUSE = /[,;:—–]$/u
const LONG_PAUSE = /[.!?…]$/u
const endsSentence = (word) => LONG_PAUSE.test(word.replace(CLOSERS, ''))

/** `"Hello`, `“Hello`, `‘Hello`, `«Bonjour`, `("Hi` — someone starts speaking. */
export function opensQuote(word) {
  const w = letters(word.replace(/^[(\[{*_]+/, ''))
  return w.length > 1 && /["“„«'‘‚]/u.test(w[0])
}

/** `said,"`, `go.’` — someone stops speaking. A ’ straight after a letter
 * is an apostrophe (`dogs’`), so single quotes only count after punctuation. */
export function closesQuote(word) {
  const w = letters(word.replace(/[)\]}*_]+$/, ''))
  const last = w.at(-1)
  if (w.length < 2) return false
  if (/["”»]/u.test(last)) return true
  return /['’]/u.test(last) && /[,.!?…;:—–-]/u.test(w.at(-2))
}

/** Every knob in the timing. Multipliers stack. */
export const CLASSIC = Object.freeze({
  longWordThreshold: 6, // letters; longer words get…
  msPerExtraChar: 30, // …this much more per letter over
  shortWordThreshold: 3, // letters; shorter words get…
  shortWordMult: 1, // …this much of the time
  shortPauseMult: 1.5, // after , ; : —
  longPauseMult: 2.5, // after . ! ? …
  paragraphPauseMs: 350, // added at a paragraph's end
  quoteOpenMult: 1,
  quoteCloseMult: 1,
  capitalizedMult: 1, // names, mid-sentence
  allCapsMult: 1,
})

// Comprehension first → speed first. The reasoning is in docs/research.md.
const TABLE = [
  //          long word   short   after  after  para   quote  quote  name   ALL
  //          over  +ms   word    , ;    . ?    +ms    opens  closes mid    CAPS   wpm
  ['Deep',     5,   50,   1.0,    2.0,   3.2,   650,   1.8,   1.5,   1.4,   1.3,   200, 'Dense or literary fiction, first reads, tired eyes.'],
  ['Careful',  6,   40,   1.0,    1.8,   2.8,   500,   1.6,   1.4,   1.3,   1.2,   250, 'Novels with lots of dialogue. Comprehension first.'],
  ['Balanced', 6,   30,   1.0,    1.5,   2.5,   350,   1.4,   1.2,   1.15,  1.1,   300, 'Straightforward prose: classic timing plus dialogue help.'],
  ['Brisk',    7,   20,   0.9,    1.3,   2.0,   250,   1.2,   1.1,   1.05,  1.0,   400, 'Light reading and rereads. Expect to miss some detail.'],
  ['Skim',     8,   10,   0.8,    1.2,   1.6,   150,   1.0,   1.0,   1.0,   1.0,   500, 'The gist only. Comprehension drops well off here.'],
]
const KEYS = ['longWordThreshold', 'msPerExtraChar', 'shortWordMult', 'shortPauseMult', 'longPauseMult',
  'paragraphPauseMs', 'quoteOpenMult', 'quoteCloseMult', 'capitalizedMult', 'allCapsMult']

export const PRESETS = TABLE.map(([name, ...row]) => ({
  name,
  wpm: row[KEYS.length],
  summary: row[KEYS.length + 1],
  pacing: Object.freeze({
    ...CLASSIC,
    ...Object.fromEntries(KEYS.map((k, i) => [k, row[i]])),
  }),
}))
export const DEFAULT_PRESET = 1

/** The preset these settings are, or -1 once fine-tuned. */
export const presetOf = (pacing) =>
  PRESETS.findIndex((p) => Object.keys(CLASSIC).every((k) => Math.abs(p.pacing[k] - pacing[k]) < 1e-9))

/** How long to hold `words[i]` on screen, in milliseconds. */
export function delay(words, i, wpm, p = CLASSIC) {
  const { text } = words[i]
  const prev = words[i - 1]
  const c = core(text) || text
  const n = letters(c).length

  let ms = 60000 / wpm + p.msPerExtraChar * Math.max(0, n - p.longWordThreshold)
  if (n <= p.shortWordThreshold) ms *= p.shortWordMult

  const end = text.replace(CLOSERS, '')
  if (LONG_PAUSE.test(end)) ms *= p.longPauseMult
  else if (SHORT_PAUSE.test(end)) ms *= p.shortPauseMult
  if (opensQuote(text)) ms *= p.quoteOpenMult
  if (closesQuote(text)) ms *= p.quoteCloseMult

  const ls = letters(c).filter(isLetter)
  if (ls.length >= 2 && ls.every(isUpper)) ms *= p.allCapsMult
  else if (ls.length >= 2 && isUpper(ls[0]) && !/^I['’]/u.test(c)) {
    // A capital that only starts a sentence or a quotation isn't news.
    const sentenceStart = !prev || prev.para !== words[i].para || endsSentence(prev.text)
    if (!sentenceStart && !opensQuote(text)) ms *= p.capitalizedMult
  }

  if (words[i + 1]?.para !== words[i].para) ms += p.paragraphPauseMs
  return Math.max(20, ms)
}

/** Plays words one at a time. Each word's time counts from when the last
 * one was *due*, not from when its timer happened to fire, so a late
 * timer never drags the whole reading behind the WPM. */
export class Player {
  index = 0
  wpm = DEFAULT_WPM
  pacing = CLASSIC
  timer = null
  now = () => performance.now()
  onchange = () => {}

  constructor(words, options = {}) {
    this.words = words
    Object.assign(this, options)
    this.index = this.#clamp(this.index)
  }

  get playing() {
    return this.timer !== null
  }

  play() {
    if (this.playing || !this.words.length) return
    if (this.index >= this.words.length - 1) this.index = 0
    this.#schedule(this.now())
    this.onchange()
  }

  pause() {
    clearTimeout(this.timer)
    this.timer = null
    this.onchange()
  }

  toggle() {
    this.playing ? this.pause() : this.play()
  }

  seek(index) {
    this.index = this.#clamp(index)
    this.#restart()
    this.onchange()
  }

  step(delta) {
    this.seek(this.index + delta)
  }

  setWpm(wpm) {
    this.wpm = Math.round(Math.min(MAX_WPM, Math.max(MIN_WPM, wpm)))
    this.#restart()
    this.onchange()
  }

  #clamp(i) {
    return Math.max(0, Math.min(Math.trunc(i) || 0, this.words.length - 1))
  }

  #restart() {
    if (!this.playing) return
    clearTimeout(this.timer)
    this.#schedule(this.now())
  }

  #schedule(from) {
    const due = from + delay(this.words, this.index, this.wpm, this.pacing)
    this.timer = setTimeout(() => {
      if (this.index >= this.words.length - 1) this.timer = null
      else {
        this.index++
        this.#schedule(due)
      }
      this.onchange()
    }, Math.max(0, due - this.now()))
  }
}
