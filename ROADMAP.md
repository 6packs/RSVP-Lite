# Roadmap

What's planned or worth doing next, roughly in order. Done items move to
[CHANGELOG.md](CHANGELOG.md).

## Next

- [ ] **Set up the permanent signing key.** Make the key and add the
  `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` secrets (see the
  README). Then install the first permanent-key build. That takes one last
  uninstall and clears the library, and from then on updates install in
  place.
- [ ] **Test on a real phone.** These Android-specific parts have only been
  checked in a phone-sized browser:
  - the system bars hiding in landscape
  - the Back button
  - the status bar matching light or dark mode
  - the press-and-hold sliders' buzz
- [ ] **Keep pinned build steps up to date.** The workflow pins each GitHub
  step to an exact commit. Dependabot (or a periodic manual check) should
  bump them, so security fixes aren't missed.

## Reading and comprehension

- [ ] **Word frequency.** The research suggests rare words deserve more time
  than common words of the same length. This needs a compact frequency list,
  perhaps the most common 5,000 English words.
- [ ] **Clause pauses without punctuation.** About 30% of natural pauses fall
  where there's no punctuation. A light heuristic could add a small pause
  before words like *which*, *because* and *although*.
- [ ] **Rewind to the sentence start on pause.** Readers normally glance back
  10–15% of the time, and RSVP takes that away. An optional setting could
  step back to the start of the sentence when you pause.
- [ ] **Per-book speed and pacing.** A dense novel and a light one may want
  different presets.

## Features left out of the rewrite

- [ ] **Library backup and restore,** as an export and import file. This also
  matters because Android backup is now off.
- [ ] **Offline web version.** `www/` needs no build, so GitHub Pages plus a
  small service worker would give a version that works in any browser.
- [ ] **Real PDF page view,** for PDFs where the layout matters.

## Known limitations

- **DRM-protected EPUBs** (many store-bought books) can't be opened.
- **Scanned PDFs** have no text to read. OCR would be a large addition.
- **A word starting with an apostrophe** (`'tis`, `'em`) counts as the start
  of a quote, so it gets the quote pause.
- **Real compounds broken across lines** before a lowercase word
  (`self-` + `same`) are joined without the hyphen.
