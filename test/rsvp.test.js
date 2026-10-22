import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it, mock } from 'node:test'
import { BASELINE } from '../www/baseline.js'
import { unzip } from '../www/books.js'
import { CLASSIC, DEFAULT_PRESET, PRESETS, Player, closesQuote, delay, opensQuote, orp, presetOf, readingSpeed, tokenize } from '../www/rsvp.js'

// Mid-paragraph timing: the word followed by another, so no paragraph pause.
const at = (word, pacing = {}, prev = 'the', wpm = 300) => {
  const words = tokenize([prev, word, 'next'].filter(Boolean).join(' '))
  return delay(words, prev ? 1 : 0, wpm, { ...CLASSIC, ...pacing })
}

describe('classic timing and focus letters', () => {
  // From the original Python engine, word for word: [word, focus, ms at 300, ms at 600].
  const cases = [
    ['wait—', 1, 300, 150],
    ['wait…', 1, 500, 250],
    ['Stop!"', 1, 500, 250],
    ['Really?”', 2, 500, 250],
    ['end.")', 1, 500, 250],
    ['3.14', 1, 200, 100],
    ['3.14.', 1, 500, 250],
    ['https://example.com/path,', 4, 1110, 960],
    ['pneumonoultramicroscopicsilicovolcanoconiosis', 4, 1370, 1270],
    ['çalışma', 2, 230, 130],
    ['sağ', 1, 200, 100],
    ['(parenthetical)', 4, 410, 310],
    ['"quoted"', 3, 200, 100],
  ]
  for (const [word, focus, ms300, ms600] of cases)
    it(word, () => {
      assert.equal(orp(word), focus)
      assert.equal(at(word, {}, null, 300), ms300)
      assert.equal(at(word, {}, null, 600), ms600)
    })

  it('adds the paragraph pause to a paragraph’s last word', () => {
    const words = tokenize('one two\n\nthree')
    assert.equal(delay(words, 1, 300), 200 + CLASSIC.paragraphPauseMs)
    assert.equal(delay(words, 0, 300), 200)
  })
})

describe('tokenize', () => {
  it('joins soft wraps, splits paragraphs, rejoins hyphenated words', () => {
    const words = tokenize('A self-\nsame line\nwraps.\n\n  Next   one. ')
    assert.deepEqual(words.map((w) => w.text), ['A', 'selfsame', 'line', 'wraps.', 'Next', 'one.'])
    assert.deepEqual(words.map((w) => w.para), [0, 0, 0, 0, 1, 1])
  })
  it('keeps real compounds when the next word is capitalized', () => {
    assert.deepEqual(tokenize('Anglo-\nSaxon').map((w) => w.text), ['Anglo-', 'Saxon'])
  })
  it('is empty for empty text', () => assert.deepEqual(tokenize('  \n\n '), []))
})

describe('quotes', () => {
  for (const w of ['"Hello', '“Hello', '‘Hello', "'Hello", '«Bonjour', '„Hallo', '("Hi']) it(`${w} opens`, () => assert(opensQuote(w)))
  for (const w of ['Hello', '"', '(aside']) it(`${w} doesn’t open`, () => assert(!opensQuote(w)))
  for (const w of ['said,"', 'said.”', 'go.’', "go,'", 'what?’)', 'Non»']) it(`${w} closes`, () => assert(closesQuote(w)))
  for (const w of ['dogs’', "dogs'", 'said', '"']) it(`${w} doesn’t close`, () => assert(!closesQuote(w)))
})

describe('pacing rules', () => {
  it('scales punctuation, long and short words', () => {
    assert.equal(at('word,', { shortPauseMult: 2 }), 400)
    assert.equal(at('word.', { longPauseMult: 4 }), 800)
    assert.equal(at('elephants', { longWordThreshold: 5, msPerExtraChar: 50 }), 400)
    assert.equal(at('cat', { shortWordMult: 0.5 }), 100)
    assert.equal(at('cats', { shortWordMult: 0.5 }), 200)
  })
  it('holds quotes, stacking with punctuation', () => {
    assert.equal(at('“Wait', { quoteOpenMult: 1.5 }), 300)
    assert.equal(at('wait,”', { quoteCloseMult: 2 }), 600)
  })
  it('holds names mid-sentence, not capitals that start something', () => {
    const p = { capitalizedMult: 1.5 }
    assert.equal(at('Anna', p, 'said'), 300)
    assert.equal(at('Anna', p, 'ended.'), 200)
    assert.equal(at('Anna', p, 'ended?”'), 200)
    assert.equal(at('Anna', p, null), 200)
    assert.equal(at('I', p, 'said'), 200)
    assert.equal(at('I’m', p, 'said'), 200)
    assert.equal(at('“Wait', p, 'said,'), 200)
  })
  it('holds ALL CAPS anywhere', () => {
    assert.equal(at('NASA', { allCapsMult: 1.5 }, null), 300)
    assert.equal(at('A', { allCapsMult: 1.5 }), 200)
  })
})

describe('presets', () => {
  const words = tokenize('“Wait,” said Anna, “the NASA files are missing.”\n\nHe shrugged. “So?” Extraordinary.')
  const total = (p, wpm) => words.reduce((sum, _, i) => sum + delay(words, i, wpm, p), 0)

  it('run from slowest to fastest, at one WPM and at their own', () => {
    for (let i = 1; i < PRESETS.length; i++) {
      assert(total(PRESETS[i].pacing, 300) < total(PRESETS[i - 1].pacing, 300))
      assert(total(PRESETS[i].pacing, PRESETS[i].wpm) < total(PRESETS[i - 1].pacing, PRESETS[i - 1].wpm))
    }
  })
  it('are recognised, and fine-tuning leaves them', () => {
    PRESETS.forEach((p, i) => assert.equal(presetOf({ ...p.pacing }), i))
    assert.equal(presetOf({ ...PRESETS[DEFAULT_PRESET].pacing, msPerExtraChar: 41 }), -1)
    assert.equal(presetOf(CLASSIC), -1)
  })
  it('default to the comprehension side', () => assert(DEFAULT_PRESET < PRESETS.length / 2))
})

describe('Player', () => {
  it('plays through at the paced rate, without drifting on late timers', () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] })
    try {
      const words = tokenize('one two three four five six seven eight nine ten')
      const expected = words.reduce((sum, _, i) => sum + delay(words, i, 600), 0) - delay(words, 9, 600)
      const player = new Player(words, { wpm: 600, now: () => Date.now() })
      player.play()
      mock.timers.tick(expected - 1)
      assert.equal(player.index, 8)
      mock.timers.tick(1)
      assert.equal(player.index, 9)
      mock.timers.tick(10_000)
      assert(!player.playing)
    } finally {
      mock.timers.reset()
    }
  })
  it('seeks, steps and clamps', () => {
    const player = new Player(tokenize('a b c d'), { index: 99 })
    assert.equal(player.index, 3)
    player.step(-2)
    assert.equal(player.index, 1)
    player.seek(-5)
    assert.equal(player.index, 0)
    player.setWpm(5)
    assert.equal(player.wpm, 50)
  })
})

describe('unzip', () => {
  it('reads stored and deflated entries from an EPUB', async () => {
    const data = await readFile(new URL('fixtures/austen-pride-and-prejudice.epub', import.meta.url))
    const read = unzip(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
    assert.equal(await read('mimetype'), 'application/epub+zip')
    assert.match(await read('META-INF/container.xml'), /rootfile/)
    assert.equal(await read('no/such/file'), null)
  })
  it('refuses to unpack past its limit', async () => {
    const data = await readFile(new URL('fixtures/austen-pride-and-prejudice.epub', import.meta.url))
    const read = unzip(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), 1000)
    assert.match(await read('META-INF/container.xml'), /rootfile/) // 252 bytes: fine
    await assert.rejects(read('OEBPS/8021792140027773854_1342-h-0.htm.html'), /far more/) // 54 kB: not
  })
})

describe('reading speed', () => {
  it('is the dial speed for plain words with no pauses', () => {
    assert.equal(readingSpeed(tokenize('the cat sat on a mat and ran off'), 450, { ...CLASSIC, paragraphPauseMs: 0 }), 450)
  })
  it('matches the whole novel on the Pride and Prejudice sample', () => {
    // Measured on all 122,000 words of the novel at 450 wpm: Original 341, Careful 301, Skim 453.
    const pride = tokenize(BASELINE)
    const near = (actual, expected) => assert(Math.abs(actual - expected) / expected < 0.03, `${actual} vs ${expected}`)
    near(readingSpeed(pride, 450, CLASSIC), 341)
    near(readingSpeed(pride, 450, PRESETS[1].pacing), 301)
    near(readingSpeed(pride, 450, PRESETS[4].pacing), 453)
  })
})
