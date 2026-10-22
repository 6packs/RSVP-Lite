import { BASELINE } from './baseline.js'
import { ACCEPT, readBook } from './books.js'
import { CLASSIC, DEFAULT_PRESET, PRESETS, Player, delay, orp, presetOf, readingSpeed, tokenize } from './rsvp.js'
import { books, save, settings } from './store.js'

const app = document.getElementById('app')
/** The real pace at `wpm`, pauses and all, measured on a sample of Pride and
 * Prejudice so the figure means the same whichever book is open. */
const PRIDE = tokenize(BASELINE)
const realSpeed = (wpm, pacing = settings.pacing) => readingSpeed(PRIDE, wpm, pacing)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Calls into the Android shell; does nothing in a plain browser. */
const native = (plugin, method, options = {}) =>
  window.Capacitor?.nativePromise?.(plugin, method, options).catch(() => {})

// --- Theme -------------------------------------------------------------

const prefersDark = matchMedia('(prefers-color-scheme: dark)')
const isDark = () => settings.theme === 'dark' || (settings.theme === 'system' && prefersDark.matches)

function applyTheme() {
  const root = document.documentElement
  root.dataset.theme = isDark() ? 'dark' : 'light'
  root.style.setProperty('--font', settings.font === 'serif' ? 'Georgia, "Noto Serif", serif' : 'system-ui, sans-serif')
  root.style.setProperty('--size', `${settings.size}px`)
  root.style.setProperty('--orp', settings.orpColor || 'var(--accent)')
  native('SystemBars', 'setStyle', { style: isDark() ? 'DARK' : 'LIGHT' })
}
prefersDark.addEventListener('change', applyTheme)

// --- Routing: #/, #/read/3, #/settings. Each screen returns its cleanup. ---

let leave = () => {}

async function route() {
  leave()
  leave = () => {}
  const [, screen, id] = location.hash.split('/')
  leave = (await (screen === 'read' ? reader(Number(id)) : screen === 'settings' ? settingsScreen() : library())) ?? leave
}

// --- Library -----------------------------------------------------------

async function library() {
  const list = (await books.list()).sort((a, b) => b.opened - a.opened)
  app.innerHTML = `
    <header class="bar">
      <h1>RSVP Lite</h1>
      <button class="quiet" data-toggle-theme aria-label="Switch to ${isDark() ? 'light' : 'dark'} mode">${isDark() ? '☀' : '☾'}</button>
      <a class="quiet" href="#/settings">Settings</a>
      <label class="button primary">Add book<input type="file" accept="${ACCEPT}" multiple hidden></label>
    </header>
    <p class="status" role="status"></p>
    ${
      list.length
        ? `<ul class="books">${list.map((b) => `
            <li>
              <a href="#/read/${b.id}">${esc(b.title)}</a>
              <small>${b.index ? `${Math.max(1, Math.floor((100 * (b.index + 1)) / b.count))}%` : 'new'}</small>
              <button class="quiet" data-remove="${b.id}" aria-label="Remove ${esc(b.title)}">✕</button>
            </li>`).join('')}
          </ul>`
        : '<p class="empty">No books yet. Add one, or drop a file here.</p>'
    }`

  const status = app.querySelector('.status')
  async function add(files) {
    let id
    for (const file of files) {
      status.textContent = `Reading “${file.name}”…`
      try {
        const { title, text } = await readBook(file)
        const now = Date.now()
        id = await books.add({ title, count: tokenize(text).length, index: 0, wpm: settings.wpm, added: now, opened: now }, text)
      } catch (e) {
        status.textContent = `${file.name}: ${e.message}`
        return
      }
    }
    if (files.length === 1) location.hash = `#/read/${id}`
    else route()
  }

  app.querySelector('input[type=file]').onchange = (e) => add([...e.target.files])
  app.querySelector('[data-toggle-theme]').onclick = () => {
    save({ theme: isDark() ? 'light' : 'dark' })
    applyTheme()
    route()
  }
  app.querySelector('.books')?.addEventListener('click', async (e) => {
    const id = Number(e.target.dataset.remove)
    const book = id && list.find((b) => b.id === id)
    if (book && confirm(`Remove “${book.title}”?`)) {
      await books.remove(id)
      route()
    }
  })

  const drop = (e) => {
    e.preventDefault()
    if (e.type === 'drop') add([...e.dataTransfer.files])
  }
  addEventListener('dragover', drop)
  addEventListener('drop', drop)
  return () => {
    removeEventListener('dragover', drop)
    removeEventListener('drop', drop)
  }
}

// --- Reader ------------------------------------------------------------

async function reader(id) {
  const [book, text] = await Promise.all([books.get(id), books.text(id)])
  if (!book || text == null) {
    location.hash = '#/'
    return
  }
  book.opened = Date.now()
  books.update(book)

  const words = tokenize(text)
  const player = new Player(words, { index: book.index, wpm: book.wpm, pacing: settings.pacing })

  app.innerHTML = `
    <div class="reader${settings.textOpen ? ' with-text' : ''}">
      <header class="bar">
        <a class="quiet" href="#/" aria-label="Library">‹</a>
        <h1>${esc(book.title)}</h1>
        <button class="quiet" data-text aria-pressed="${!!settings.textOpen}">Text</button>
      </header>
      <div class="stage"><div class="word"><span></span><b></b><span></span></div></div>
      <article class="text" aria-label="Text around the current word"></article>
      <footer class="controls">
        <input class="scrub" type="range" min="0" max="${words.length - 1}" aria-label="Position in book">
        <div class="row">
          <button class="primary play"></button>
          <span class="where"></span>
          <span class="speed">
            <button data-wpm="-25" aria-label="Slower">−</button>
            <output></output>
            <button data-wpm="25" aria-label="Faster">+</button>
          </span>
        </div>
      </footer>
    </div>`

  const $ = (selector) => app.querySelector(selector)
  const [stage, word, textView, scrub, play, where, wpm] =
    ['.stage', '.word', '.text', '.scrub', '.play', '.where', 'output'].map($)
  const [pre, focus, post] = word.children

  /** Shows the word with its focus letter centred at 42% of the stage's
   * width, shrinking it only if it wouldn't otherwise fit. */
  function showWord() {
    const chars = [...(words[player.index]?.text ?? '')]
    const at = orp(chars.join(''))
    pre.textContent = chars.slice(0, at).join('')
    focus.textContent = chars[at] ?? ''
    post.textContent = chars.slice(at + 1).join('')

    word.style.fontSize = ''
    const width = stage.clientWidth
    const focusX = width * 0.42
    const measure = () => [pre, focus, post].map((el) => el.getBoundingClientRect().width)
    let [a, b, c] = measure()
    const scale = Math.min(1, (focusX - 12) / (a + b / 2), (width - focusX - 12) / (b / 2 + c))
    if (scale < 1) {
      word.style.fontSize = `${parseFloat(getComputedStyle(word).fontSize) * scale}px`
      ;[a, b] = measure()
    }
    word.style.translate = `${focusX - a - b / 2}px -50%`
  }

  // The surrounding text, a few hundred words either side, one tap per word to jump.
  let shown = { from: 0, to: 0 }
  function showText() {
    if (!settings.textOpen) return
    const i = player.index
    if (i < shown.from || i >= shown.to) {
      let from = Math.max(0, i - 300)
      let to = Math.min(words.length, i + 300)
      while (from > 0 && words[from - 1].para === words[from].para) from--
      while (to < words.length && words[to].para === words[to - 1].para) to++
      let html = ''
      for (let j = from; j < to; j++) {
        if (j === from || words[j].para !== words[j - 1].para) html += j === from ? '<p>' : '</p><p>'
        html += `<span data-i="${j}">${esc(words[j].text)}</span> `
      }
      textView.innerHTML = html + '</p>'
      shown = { from, to }
    }
    textView.querySelector('.now')?.classList.remove('now')
    const span = textView.querySelector(`[data-i="${i}"]`)
    span.classList.add('now')
    // Keep the word in the upper part of the panel: once reading carries it
    // past two-thirds of the way down (or it's above the top), glide it back
    // to a third. Scrolling away while paused is left alone until it moves.
    const { scrollTop, clientHeight } = textView
    if (span.offsetTop < scrollTop || span.offsetTop > scrollTop + clientHeight * (2 / 3))
      textView.scrollTo({ top: span.offsetTop - clientHeight / 3, behavior: player.playing ? 'smooth' : 'auto' })
  }

  let lock = null
  let lastSave = 0
  function update() {
    showWord()
    showText()
    scrub.value = player.index
    play.textContent = player.playing ? 'Pause' : 'Play'
    where.textContent = `${(player.index + 1).toLocaleString()} / ${words.length.toLocaleString()}`
    if (wpm.dataset.wpm !== String(player.wpm)) {
      wpm.dataset.wpm = player.wpm
      wpm.innerHTML = `${player.wpm} wpm<small>≈ ${realSpeed(player.wpm)} real</small>`
    }

    if (player.playing && !lock) navigator.wakeLock?.request('screen').then((l) => (lock = l), () => {})
    if (!player.playing && lock) {
      lock.release()
      lock = null
    }
    if (!player.playing || Date.now() - lastSave > 5000) keep()
  }
  function keep() {
    lastSave = Date.now()
    Object.assign(book, { index: player.index, wpm: player.wpm })
    books.update(book)
  }
  player.onchange = update

  // Tap the left quarter to step back, the right to step on, the middle to play or pause.
  stage.onclick = (e) => {
    const x = (e.clientX - stage.getBoundingClientRect().left) / stage.clientWidth
    x < 0.25 ? player.step(-1) : x > 0.75 ? player.step(1) : player.toggle()
  }
  play.onclick = () => player.toggle()
  scrub.oninput = () => player.seek(Number(scrub.value))
  $('.speed').onclick = (e) => e.target.dataset.wpm && player.setWpm(player.wpm + Number(e.target.dataset.wpm))
  textView.onclick = (e) => e.target.dataset.i && player.seek(Number(e.target.dataset.i))
  $('[data-text]').onclick = (e) => {
    save({ textOpen: !settings.textOpen })
    e.target.setAttribute('aria-pressed', settings.textOpen)
    $('.reader').classList.toggle('with-text', settings.textOpen)
    shown = { from: 0, to: 0 }
    update()
  }

  const keys = (e) => {
    if (e.target.matches('input')) return
    const actions = {
      ' ': () => player.toggle(),
      ArrowLeft: () => player.step(e.shiftKey ? -10 : -1),
      ArrowRight: () => player.step(e.shiftKey ? 10 : 1),
      ArrowUp: () => player.setWpm(player.wpm + 25),
      ArrowDown: () => player.setWpm(player.wpm - 25),
      t: () => $('[data-text]').click(),
      Escape: () => (location.hash = '#/'),
    }
    if (actions[e.key]) {
      e.preventDefault()
      actions[e.key]()
    }
  }
  addEventListener('keydown', keys)

  // Held sideways on a phone, the word fills the screen (see style.css) and
  // the system bars get out of the way.
  const sideways = matchMedia('(orientation: landscape) and (pointer: coarse)')
  const bars = () => native('SystemBars', sideways.matches ? 'hide' : 'show')
  sideways.addEventListener('change', bars)
  bars()

  const resized = new ResizeObserver(showWord)
  resized.observe(stage)
  const hidden = () => document.hidden && player.pause()
  document.addEventListener('visibilitychange', hidden)
  update()

  return () => {
    player.pause()
    keep()
    removeEventListener('keydown', keys)
    sideways.removeEventListener('change', bars)
    native('SystemBars', 'show')
    resized.disconnect()
    document.removeEventListener('visibilitychange', hidden)
  }
}

// --- Settings ----------------------------------------------------------

const FINE_TUNING = {
  'Word length': [
    ['longWordThreshold', 'Long words are over', 3, 15, 1, 'letters'],
    ['msPerExtraChar', 'Extra time per letter over that', 0, 120, 5, 'ms'],
    ['shortWordThreshold', 'Short words are up to', 1, 6, 1, 'letters'],
    ['shortWordMult', 'Short word time', 0.5, 2, 0.05, '×'],
  ],
  Punctuation: [
    ['shortPauseMult', 'After , ; : —', 1, 4, 0.1, '×'],
    ['longPauseMult', 'After . ! ? …', 1, 5, 0.1, '×'],
    ['paragraphPauseMs', 'Paragraph end (added)', 0, 1500, 25, 'ms'],
  ],
  Dialogue: [
    ['quoteOpenMult', 'First word of a quote', 1, 4, 0.1, '×'],
    ['quoteCloseMult', 'Last word of a quote', 1, 4, 0.1, '×'],
  ],
  Capitals: [
    ['capitalizedMult', 'Capitalized mid-sentence (names)', 1, 3, 0.05, '×'],
    ['allCapsMult', 'ALL CAPS words', 1, 3, 0.05, '×'],
  ],
}
const SAMPLE = tokenize('“Wait,” said Anna, “the NASA files are missing.” He shrugged. “So?”')
const show = (v, unit) => (unit === '×' ? `×${v.toFixed(2)}` : `${v} ${unit}`)

function settingsScreen() {
  const option = (value, label, current) => `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`
  app.innerHTML = `
    <header class="bar"><a class="quiet" href="#/" aria-label="Library">‹</a><h1>Settings</h1></header>
    <form class="settings stack">
      <label>Theme
        <select name="theme">${option('dark', 'Dark', settings.theme)}${option('light', 'Light', settings.theme)}${option('system', 'Same as the phone', settings.theme)}</select>
      </label>
      <label>Font
        <select name="font">${option('sans', 'Sans serif', settings.font)}${option('serif', 'Serif', settings.font)}</select>
      </label>
      <label>Word size <output data-for="size"></output>
        <input name="size" type="range" min="28" max="120" value="${settings.size}">
      </label>
      <label class="inline"><input name="customOrp" type="checkbox"${settings.orpColor ? ' checked' : ''}> Own color for the focus letter
        <input name="orpColor" type="color" value="${settings.orpColor || '#ff5a5f'}"${settings.orpColor ? '' : ' hidden'}>
      </label>
      <label>Speed for new books (wpm) <output data-for="real"></output>
        <input name="wpm" type="number" min="50" max="1500" step="25" value="${settings.wpm}">
      </label>

      <h2>Pacing</h2>
      <p class="hint">The speed dial sets the pace of a plain word. Pauses for punctuation, long words, quotes and names make the real pace slower, so it’s shown alongside as “≈ N real”: words a minute on a sample of <i>Pride and Prejudice</i>.</p>
      <p class="hint touch-only">Hold a slider for a moment to move it, so scrolling past one never changes it.</p>
      <label>
        <span class="ends"><span>Comprehension</span><span>Speed</span></span>
        <input name="preset" type="range" min="0" max="${PRESETS.length - 1}" aria-label="Comprehension versus speed">
        <span class="ends presets">${PRESETS.map((p) => `<span>${p.name}</span>`).join('')}</span>
      </label>
      <p class="card" aria-live="polite"></p>

      <h3>Fine-tune</h3>
      <p class="hint">How long each word stays up, relative to the WPM. Multipliers stack: a quote’s last word that ends a sentence gets both.</p>
      ${Object.entries(FINE_TUNING).map(([group, controls]) => `
        <fieldset class="stack"><legend>${group}</legend>
          ${controls.map(([key, label, min, max, step]) => `
            <label>${label} <output data-for="${key}"></output>
              <input name="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings.pacing[key]}">
            </label>`).join('')}
        </fieldset>`).join('')}

      <div><h3>Preview <span class="hint">at <span data-for="wpm"></span> wpm, ≈ <span data-for="real"></span> real</span></h3><p class="preview"></p></div>
      <div class="row">
        <button type="button" data-pacing="default">Reset to defaults</button>
        <button type="button" data-pacing="classic">Original timing</button>
      </div>
    </form>`

  const form = app.querySelector('form')
  let lastPreset = Math.max(0, presetOf(settings.pacing))

  function refresh() {
    const p = settings.pacing
    const at = presetOf(p)
    if (at >= 0) lastPreset = at
    form.preset.value = lastPreset // a fine-tuned setup stays where its preset was
    form.querySelectorAll('.presets span').forEach((el, i) => el.classList.toggle('on', i === at))
    for (const controls of Object.values(FINE_TUNING))
      for (const [key, , , , , unit] of controls) {
        form[key].value = p[key]
        form.querySelector(`[data-for="${key}"]`).textContent = show(p[key], unit)
      }
    form.querySelector('[data-for="size"]').textContent = `${settings.size}px`
    form.querySelector('[data-for="wpm"]').textContent = settings.wpm
    const real = realSpeed(settings.wpm, p)
    form.querySelectorAll('[data-for="real"]').forEach((el) => (el.textContent = el.matches('output') ? `≈ ${real} real` : real))

    const preset = PRESETS[at]
    form.querySelector('.card').innerHTML = preset
      ? `<b>${preset.name}.</b> ${preset.summary} Suggested speed: ${preset.wpm} wpm (≈ ${realSpeed(preset.wpm, p)} real).
         ${settings.wpm === preset.wpm ? '' : `<button type="button" data-use-wpm="${preset.wpm}">Use it for new books</button>`}`
      : '<b>Custom.</b> Fine-tuned below. Pick a point on the slider to go back to a preset.'
    form.querySelector('.preview').innerHTML = SAMPLE.map(
      (w, i) => `<span>${esc(w.text)}<small>${Math.round(delay(SAMPLE, i, settings.wpm, p))}</small></span>`,
    ).join(' ')
  }

  form.oninput = (e) => {
    const { name, value, checked } = e.target
    if (name === 'preset') save({ pacing: PRESETS[value].pacing })
    else if (name in CLASSIC) save({ pacing: { ...settings.pacing, [name]: Number(value) } })
    else if (name === 'customOrp') {
      form.orpColor.hidden = !checked
      save({ orpColor: checked ? form.orpColor.value : '' })
    } else if (name === 'wpm') {
      if (value >= 50 && value <= 1500) save({ wpm: Number(value) })
    } else save({ [name]: name === 'size' ? Number(value) : value })
    applyTheme()
    refresh()
  }
  form.onclick = (e) => {
    const { pacing, useWpm } = e.target.dataset
    if (pacing) save({ pacing: pacing === 'classic' ? CLASSIC : PRESETS[DEFAULT_PRESET].pacing })
    if (useWpm) {
      save({ wpm: Number(useWpm) })
      form.wpm.value = useWpm
    }
    if (pacing || useWpm) refresh()
  }
  form.onsubmit = (e) => e.preventDefault()
  holdToSlide(form)
  refresh()
}

/** On a touch screen, a slider in a scrolling page is easy to nudge by
 * accident. So there (see style.css) sliders ignore touches of their own,
 * and a press held still for a moment picks one up and slides it instead.
 * A swipe that starts on a slider just scrolls the page. */
function holdToSlide(root, holdMs = 250) {
  root.addEventListener('pointerdown', (down) => {
    if (down.pointerType !== 'touch') return
    const range = [...root.querySelectorAll('input[type=range]')].find((r) => {
      const box = r.getBoundingClientRect()
      return down.clientX >= box.left && down.clientX <= box.right && Math.abs(down.clientY - (box.top + box.height / 2)) < 24
    })
    if (!range) return

    let held = false
    const slide = (e) => {
      const box = range.getBoundingClientRect()
      const at = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
      const before = range.value
      range.value = Number(range.min) + at * (range.max - range.min) // the browser snaps it to the step
      if (range.value !== before) range.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const timer = setTimeout(() => {
      held = true
      range.classList.add('held')
      navigator.vibrate?.(10)
      slide(down)
    }, holdMs)
    const move = (e) => {
      if (held) slide(e)
      else if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) > 8) end() // it's a scroll
    }
    const end = () => {
      clearTimeout(timer)
      range.classList.remove('held')
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', end)
      removeEventListener('pointercancel', end)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', end)
    addEventListener('pointercancel', end)
  })
}

// --- Start, once everything above is defined --------------------------

addEventListener('hashchange', route)
applyTheme()
route()
