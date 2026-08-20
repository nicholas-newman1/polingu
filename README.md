# Polingu

A comprehensive Polish language learning app built around spaced repetition. Drill declensions and conjugations, build vocabulary, translate sentences, read your own texts and PDFs with tap-to-translate, and reinforce everything with synced audio and passive listening—all backed by an intelligent review system that optimizes your study time.

## Features

### Spaced Repetition Modules

Five learning modules are scheduled with the [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) algorithm (the same scheduler used by Anki). After revealing an answer, rate your recall—**Again**, **Hard**, **Good**, or **Easy**—and each card is scheduled at its optimal next interval.

- **Declension** — Master Polish noun and pronoun declensions across all 7 cases (Nominative, Genitive, Dative, Accusative, Instrumental, Locative, Vocative) with fill-in-the-blank flashcards showing case, gender, and number.
- **Vocabulary** — Learn common Polish words with example sentences, parts of speech, gender, and audio.
- **Sentences** — Practice translating complete Polish sentences with word-by-word annotations, organized by CEFR level (A1–C2).
- **Conjugation** — Drill Polish verb forms across tenses, persons, numbers, and aspects, with filtering by tense, person, number, aspect, verb class, and gender.
- **Aspect Pairs** — Learn perfective/imperfective verb pairs, with conjugation reference built in.

### Bidirectional Learning

Vocabulary, sentences, and conjugation each support two practice directions, with separate review progress tracked per direction:

- **Recognition** (Polish → English) — See Polish, produce English
- **Production** (English → Polish) — See English, produce Polish

### Flexible Study Options

- **Practice Mode** — Drill cards without affecting SRS progress
- **Practice Ahead** — Review cards before they're due
- **Learn Extra** — Add more new cards beyond your daily limit
- **Card history** — Step back through rated cards to reassess them
- Configurable daily new-card limit per module and direction

### Smart Filtering

- Filter declension cards by case, gender, and number
- Filter conjugation cards by tense, person, number, aspect, verb class, and gender
- Filter sentences by CEFR level (A1–C2)
- Filters affect new cards while due reviews always appear

### Audio

- **Card audio** — Most cards include Polish text-to-speech, with optional auto-play and an "audio-only" mode that hides the Polish text
- **Audio Library** — Upload your own audio files or generate audio from pasted text; tracks are transcribed automatically into timestamped segments
- **Audio Player** — Karaoke-style player that highlights the transcript at the segment and word level as it plays, with adjustable speed, track navigation, and font size
- **Offline audio** — Download all card audio for offline study

### Passive Listening

A dedicated listening mode turns your sentence, vocabulary, or declension decks into passive audio sessions. Choose an ordering (random, due-first, practice-ahead, learned-only, or recently-added), configure separate playback settings for learned vs. unfamiliar cards, and keep listening via a mini player that persists across the app. Listening is purely for reinforcement and does not affect SRS progress.

### Reader & Library

Paste plain text or upload PDF books to your library and read them in-app. Text books render as continuous, responsive HTML with adjustable font size and are cached for offline reading; PDFs are rendered with `pdfjs-dist`. Tap any word or drag-select a phrase to translate it, save bookmarks, and pick up where you left off—reading progress is saved per book.

### Consonant Driller

A quick, session-based drill (no SRS) for classifying Polish consonants as hard or soft, either by consonant or within example words.

### Interactive Word Translations

- **Tap any word** to see its English translation, lemma, and grammar info
- **Drag-select phrases** to get contextual translations
- Save any word or phrase straight to your custom vocabulary or sentences
- Translations are cached to minimize API calls

### Built-in Translator

Access the English ↔ Polish translator from the bottom menu to look up words and phrases outside of flashcard sessions, and save results directly into your decks.

### Reference Cheat Sheets

Quick-access reference materials from the bottom menu:

- **Declension endings** — Complete tables for masculine, feminine, and neuter nouns
- **Conjugation** — Verb conjugation reference
- **Consonants** — Soft, hard, and hardened consonant categories
- **Y/I rules** — When to use Y vs I in Polish spelling

### Custom Content

Add your own learning material alongside the built-in content:

- Create custom vocabulary, declension cards, and sentences
- Manage them in dedicated pages (`My Vocabulary`, `My Declensions`, `My Sentences`) with search and filtering
- Audio is generated automatically for custom items
- Duplicate detection lets you re-prioritize an existing card instead of adding a copy

### Statistics

- **Dashboard** — Learned, total, and due counts per module, with reorderable feature cards
- **Stats page** — Detailed breakdown of studied, mastered, and total cards, including system vs. custom content

### Accounts & Cloud Sync

- **Guest mode** — Use the app and study built-in content without signing in
- **Google sign-in** — Sync review progress, custom content, and settings across devices via Firebase
- Works offline with automatic background sync when you reconnect

### Offline-First (PWA)

Polingu is an installable Progressive Web App:

- Install to your home screen and use it like a native app
- Built-in content is cached in IndexedDB (via Dexie) for offline access
- A service worker precaches the app shell and caches audio for offline playback
- User data is written locally first and synced to Firestore when online

### Admin Tooling

For users with the admin role:

- **Content manager** — CRUD for system vocabulary, declensions, sentences, and verbs
- **Sentence generator** — AI-assisted sentence generation, curriculum discovery, and tagging
- **System audio** — Generate shared audio tracks from text, and edit transcript segments

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Data & Audio Scripts

Content and audio pipelines are managed through `tsx` scripts (require Firebase Admin credentials):

```bash
# Declension content
npm run declension:import      # Import declension JSON into Firestore
npm run declension:sync        # Sync Firestore declensions to local index
npm run declension:export      # Export declension cards to JSON

# Verb content
npm run verbs:import           # Import verbs JSON into Firestore
npm run verbs:validate         # Validate verb JSON schema
npm run verbs:sync             # Sync verbs from Firestore
npm run verbs:export           # Export verbs to JSON

# Text-to-speech audio generation
npm run audio:vocabulary
npm run audio:declension
npm run audio:sentences
npm run audio:conjugation
npm run audio:aspect-pairs
```

## Tech Stack

- **React 19** + TypeScript
- **Vite 7** — Build tool and dev server
- **MUI 7** (Material UI) + Emotion — Component library and styling
- **Firebase** — Auth, Firestore, Storage, and Cloud Functions
- **Dexie** — IndexedDB wrapper for offline-first storage
- **ts-fsrs** — Spaced repetition scheduling
- **pdfjs-dist** — In-app PDF reader
- **vite-plugin-pwa** (Workbox) — Service worker and installable PWA
- **@tanstack/react-virtual**, **@dnd-kit** — Virtualization and drag-and-drop
- **Google Cloud Text-to-Speech** — Audio generation
