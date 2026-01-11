# Sentence Bank Documentation

This document describes the sentence data structure and workflow for AI-assisted sentence generation.

## Data Structure

Each sentence has the following structure:

```typescript
interface Sentence {
  id: string;           // Format: "{level}_{number}" e.g., "a1_001", "b2_015"
  polish: string;       // The Polish sentence
  english: string;      // English translation
  level: CEFRLevel;     // "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
  tags: string[];       // Topic, grammar, and style tags
  words: WordAnnotation[];
}

interface WordAnnotation {
  word: string;         // The word as it appears in the sentence
  lemma: string;        // Dictionary form
  english: string;      // English translation
  grammar?: string;     // Grammar notes (case, tense, gender, etc.)
  notes?: string;       // Additional context or usage notes
}
```

## Example Sentence

```json
{
  "id": "b1_007",
  "polish": "Gdybym miał więcej czasu, pojechałbym do Polski.",
  "english": "If I had more time, I would go to Poland.",
  "level": "B1",
  "tags": ["conditional", "travel"],
  "words": [
    { "word": "Gdybym", "lemma": "gdyby", "english": "if I", "grammar": "conditional conjunction + 1st person" },
    { "word": "miał", "lemma": "mieć", "english": "had", "grammar": "past participle, masculine singular" },
    { "word": "więcej", "lemma": "więcej", "english": "more", "grammar": "comparative adverb" },
    { "word": "czasu", "lemma": "czas", "english": "time", "grammar": "genitive singular (masculine)" },
    { "word": "pojechałbym", "lemma": "pojechać", "english": "I would go", "grammar": "conditional, masculine, 1st person" },
    { "word": "do", "lemma": "do", "english": "to", "grammar": "preposition + genitive" },
    { "word": "Polski", "lemma": "Polska", "english": "Poland", "grammar": "genitive singular (feminine)" }
  ]
}
```

## Available Tags

### Topics
basics, introduction, family, food, restaurant, travel, location, shopping, health, business, communication, social, learning, time

### Grammar
past tense, future, conditional, questions, requests, polite requests, modal verbs, obligation, subjunctive, subordinate clauses, relative clauses, comparative, correlative, impersonal, concession, temporal clauses, sequence of events

### Style
formal, criticism, advice, opinions, predictions, reflection, preferences

## ID Format

IDs follow the pattern `{level}_{number}`:
- Level is lowercase: a1, a2, b1, b2, c1, c2
- Number is zero-padded to 3 digits: 001, 002, ..., 999

When generating new sentences, check `sentenceIndex.json` for the highest existing ID for that level and continue from there.

## CLI Commands

```bash
# Import new sentences from a JSON file
npm run sentences:import <file.json>

# Sync local index from Firestore
npm run sentences:sync

# Export sentences (optionally filtered by level)
npm run sentences:export [level]

# One-time migration from sentenceBank.json
npm run sentences:migrate
```

## Generation Workflow

When requesting new sentences from AI:

1. Share the relevant portion of `sentenceIndex.json` (or the whole file for smaller banks)
2. Specify the target level and topics/grammar focus
3. AI generates sentences in the correct JSON format
4. Save AI output to a file (e.g., `new-sentences.json`)
5. Run `npm run sentences:import new-sentences.json`

## Grammar Annotation Guidelines

When annotating words, include:
- **Case**: nominative, genitive, dative, accusative, instrumental, locative, vocative
- **Number**: singular, plural
- **Gender**: masculine (animate/inanimate), feminine, neuter
- **Person**: 1st, 2nd, 3rd person
- **Tense**: present, past, future
- **Aspect**: perfective, imperfective (for verbs)
- **Mood**: indicative, conditional, imperative

Example formats:
- "nominative singular (masculine)"
- "past tense, feminine, 3rd person (perfective)"
- "genitive plural"
- "preposition + instrumental"

