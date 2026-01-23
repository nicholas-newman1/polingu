# Polingu

A comprehensive Polish language learning app with spaced repetition. Practice declensions, build vocabulary, and translate sentences—all with an intelligent review system that optimizes your study time.

## Features

### Three Learning Modules

- **Declension** — Master Polish noun and pronoun declensions across all 7 cases (Nominative, Genitive, Dative, Accusative, Instrumental, Locative, Vocative) with fill-in-the-blank flashcards
- **Vocabulary** — Learn common Polish words with example sentences, parts of speech, and gender information
- **Sentences** — Practice translating complete Polish sentences with detailed word-by-word annotations including lemmas and grammar notes

### FSRS Spaced Repetition

Uses the Free Spaced Repetition Scheduler algorithm (same as Anki) to schedule reviews at optimal intervals. After revealing an answer, rate your recall:

- **Again** — Forgot completely (card repeats in session)
- **Hard** — Struggled to remember
- **Good** — Remembered with effort
- **Easy** — Instantly recalled

### Bidirectional Learning

Vocabulary and sentences support two practice modes:

- **Recognition** (Polish → English) — See Polish, produce English
- **Production** (English → Polish) — See English, produce Polish

### Smart Filtering

- Filter declension cards by case, gender, and number
- Filter sentences by CEFR level (A1–C2)
- Filters affect new cards while due reviews always appear

### Interactive Word Translations

- **Tap any word** to see its English translation, lemma, and grammar info
- **Drag-select phrases** to get contextual translations
- Translations are cached to minimize API calls

### Built-in Translator

Access the English ↔ Polish translator from the bottom menu to quickly look up words and phrases outside of flashcard sessions.

### Reference Cheat Sheets

Quick-access reference materials available from the bottom menu:

- **Declension endings** — Complete tables for masculine, feminine, and neuter nouns
- **Consonants** — Soft, hard, and hardened consonant categories
- **Y/I rules** — When to use Y vs I in Polish spelling

### Custom Content

Add your own learning material alongside the system content:

- Create custom vocabulary words with part of speech, gender, and notes
- Create custom declension flashcards
- Manage your custom items in dedicated pages with search and filtering

### Cloud Sync

- Sign in with Google to sync progress across devices
- All review data stored in Firebase
- Works offline with automatic sync when back online

### Flexible Study Options

- **Practice Mode** — Drill cards without affecting SRS progress
- **Practice Ahead** — Review cards before they're due
- **Learn Extra** — Add more new cards beyond your daily limit
- Configurable daily new card limit per module

### Study Statistics

Track your learning progress:

- Cards studied and mastered
- Breakdown of system vs custom content
- Separate stats for vocabulary and declension

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Tech Stack

- **React 19** + TypeScript
- **MUI** (Material UI) — Component library and styling
- **Firebase** — Firestore database and Google authentication
- **Vite** — Build tool
- **ts-fsrs** — Spaced repetition algorithm
