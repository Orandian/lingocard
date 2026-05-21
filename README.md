# LingoCard

A local translation app: translate text, collect example sentences, save them as Anki decks, and practice with built-in flashcards. Everything runs on your machine and saves to your browser — no account, no API key.

## Features
- **Translate** from an input box across 16 configurable language pairs
- **Example sentences** mined automatically for each translation
- **Save as decks** and **export to Anki** (tab-separated `.txt`, ready for Anki's text importer)
- **Practice mode** with card flipping and Leitner spaced-repetition scheduling

## Run locally
```bash
npm install
npm run dev
```
Then open http://localhost:3000

## How translation works
Uses the free, no-signup [MyMemory](https://mymemory.translated.net/) API, which supports many language pairs and returns example matches. It needs an internet connection but no API key. To swap in a different engine (a local dictionary, or an AI API), edit `src/lib/translate.ts` — it's the only file that talks to the translation service.

## Importing into Anki
1. In a deck, click **Export Anki** to download a `.txt` file.
2. In Anki: **File → Import**, choose the file.
3. Fields map to: Front, Back, Examples (tab-separated, HTML enabled).

## Tech
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4. Decks persist in `localStorage`.

## Project layout
```
src/
  app/            page, layout, global styles
  components/     Translator, DeckManager, Practice
  lib/            translate.ts, anki.ts, languages.ts
  store/          useDecks.ts (localStorage + scheduling)
  types/          shared types
```
