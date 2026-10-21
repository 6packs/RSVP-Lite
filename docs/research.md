# Pacing: what the research says, and how the presets use it

Notes behind `PRESETS` in `www/rsvp.js` and the
comprehension ↔ speed slider in Settings → Pacing.

## What's out there

There is **no systematic review or meta-analysis of RSVP and comprehension**.
The closest thing is a broad review of speed reading, plus a few dozen primary
studies. Almost none use complex fiction specifically. So these presets are
informed by the evidence, not proven by it.

- **Rayner, Schotter, Masson, Potter & Treiman (2016)**, *So much to read, so
  little time*, Psychological Science in the Public Interest 17(1). This is the
  authoritative review. It finds a real trade-off between speed and
  comprehension, and says doubling or tripling speed while keeping full
  comprehension is unlikely. RSVP specifically removes two things that support
  understanding: rereading (regressions) and parafoveal preview of the next
  word.
- **Schotter, Tran & Rayner (2014)**, *Don't believe what you read (only
  once)*, Psychological Science. Regressions are about 10–15% of eye movements
  in normal reading. Blocking them, which RSVP does, measurably hurts
  comprehension, and not only for ambiguous sentences.
- **Benedetto et al. (2015)**, *RSVP in reading: the case of Spritz*,
  Computers in Human Behavior. On a book excerpt, Spritz-style RSVP impaired
  literal comprehension and increased visual fatigue, partly because readers
  blinked less.
- **Ricciardi & Di Nocera (2017)**, and **Di Nocera, Ricciardi & Juola
  (2018)** (209 participants, 250–450 WPM): comprehension under RSVP did not
  differ from normal reading at **250–350 WPM**, then fell at higher rates. The
  loss looks like a problem of encoding, not of attention.
- **Ricciardi et al. (2020)**, *Speed reading using Spritz has a cost*:
  comprehension dropped above **250 WPM** even for a very short text.
- **Öquist & Goldstein (2002/2003)**, *adaptive RSVP*. Varying exposure time
  by word length, word frequency and sentence structure kept comprehension the
  same as fixed-rate RSVP, but **lowered task load** (effort, frustration).
  Fixed-rate RSVP on long texts raised task load significantly.
- **Castelhano & Muter (2001)**, Behaviour & Information Technology. Pauses at
  punctuation and at clause boundaries made RSVP significantly preferred over
  plain RSVP.
- **Busler (2013)**, Auburn dissertation. Longer pauses at clause and sentence
  ends improved recall of complex, multi-clause texts for readers with both
  high and low working memory.
- **Wrap-up effects** in eye-tracking. Readers naturally linger on clause- and
  sentence-final words, and the effect follows punctuation closely. Natural
  reading time also rises with word length, low frequency, names and new
  topics.
- **Fiction specifically.** Reviews of Spritz on novels (e.g. *Speed-reading
  the Man Booker shortlist*, The Rumpus, 2014) call dialogue and nuanced
  literary writing its weak spot. Long, winding sentences get hard to follow.

## How the presets use it

| | Deep | **Careful** (default) | Balanced | Brisk | Skim |
|---|---|---|---|---|---|
| Suggested WPM | 200 | **250** | 300 | 400 | 500 |
| Long word: over / +ms per letter | 5 / 50 | 6 / 40 | 6 / 30 | 7 / 20 | 8 / 10 |
| Short words (≤3 letters) | ×1.0 | ×1.0 | ×1.0 | ×0.9 | ×0.8 |
| After , ; : — | ×2.0 | ×1.8 | ×1.5 | ×1.3 | ×1.2 |
| After . ! ? … | ×3.2 | ×2.8 | ×2.5 | ×2.0 | ×1.6 |
| Paragraph end | +650 ms | +500 ms | +350 ms | +250 ms | +150 ms |
| Quote opens / closes | ×1.8 / ×1.5 | ×1.6 / ×1.4 | ×1.4 / ×1.2 | ×1.2 / ×1.1 | off |
| Names mid-sentence / ALL CAPS | ×1.4 / ×1.3 | ×1.3 / ×1.2 | ×1.15 / ×1.1 | ×1.05 / off | off |

- **Speed is the biggest lever.** The default WPM is now 250, the point up to
  which studies find RSVP comprehension matching normal reading. Each preset
  suggests a WPM but only changes it if you tap "Use it for new books".
- **Time goes where normal reading slows down anyway.** This means long words,
  clause and sentence ends (the wrap-up effect), paragraph breaks (in fiction
  these are usually also speaker changes), the start and end of quoted speech,
  and names. This follows adaptive RSVP and the clause-pause studies.
- **Short words aren't sped up on the comprehension side.** Trimming function
  words saves little time and costs parsing in complex sentences. Only Brisk
  and Skim do it.
- **Balanced** is the original app's timing plus moderate dialogue and name
  holds. **Skim** turns the dialogue and capital rules off entirely.

## What RSVP can't give back

No timing scheme replaces the ability to glance back. When a sentence doesn't
land, tap the left edge to step back word by word, or pause. That is the
regression the studies say comprehension depends on.

## Sources

- Rayner et al. 2016: https://profiles.wustl.edu/en/publications/so-much-to-read-so-little-time-how-do-we-read-and-can-speed-readi/
- Schotter, Tran & Rayner 2014: https://journals.sagepub.com/doi/abs/10.1177/0956797614531148
- Benedetto et al. 2015: https://iris.uniroma1.it/handle/11573/923334
- Di Nocera, Ricciardi & Juola 2018: https://www.inderscience.com/filter.php?aid=96118
- Ricciardi et al. 2020: https://inderscience.com/offers.php?id=109594
- Öquist & Goldstein 2002: https://unpaywall.org/10.1007%2F3-540-45756-9_18
- Castelhano & Muter 2001: https://web-archive.southampton.ac.uk/cogprints.org/1934/index.html
- Busler 2013: https://auetd.auburn.edu/handle/10415/3911?show=full
- Wrap-up effects: https://pmc.ncbi.nlm.nih.gov/articles/PMC2682724
- The Rumpus 2014: https://therumpus.net/2014/09/24/speed-reading-the-man-booker-shortlist
