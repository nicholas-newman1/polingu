# Declension Card Documentation

This document describes the declension card data structure and workflow for AI-assisted card generation.

## Data Structure

Each declension card has the following structure:

```typescript
interface DeclensionCard {
  id: number;              // Sequential numeric ID starting from 1
  front: string;           // Prompt with blank, e.g., "To jest ___ (nauczyciel)."
  back: string;            // Complete sentence with correct declension
  declined: string;        // The declined word that fills the blank
  case: Case;              // The grammatical case being tested
  gender: Gender;          // Gender of the noun/pronoun
  number: NumberType;      // Singular or Plural
  english: string;         // English translation of the whole `back` sentence
  hint?: string;           // Optional hint explaining the grammar rule
}

type Case = 'Nominative' | 'Genitive' | 'Dative' | 'Accusative' | 'Instrumental' | 'Locative' | 'Vocative';
type Gender = 'Masculine' | 'Feminine' | 'Neuter' | 'Pronoun';
type NumberType = 'Singular' | 'Plural';
```

## Example Card

```json
{
  "id": 286,
  "front": "Idę do ___ (sklep).",
  "back": "Idę do sklepu",
  "declined": "sklepu",
  "case": "Genitive",
  "gender": "Masculine",
  "number": "Singular",
  "english": "I'm going to the store",
  "hint": "\"do\" takes genitive. Inanimate"
}
```

## Card Format Guidelines

### Front (Prompt)
- Contains the sentence with a blank (`___`) where the declined word goes
- The base form (nominative singular) is shown in parentheses, e.g., `___ (dom)`
- For plural, add `(pl)` marker: `___ (dom) (pl)`
- Start sentence with capital letter appropriately

### Back (Answer)
- Complete sentence with the correctly declined word
- Matches the front sentence structure

### English
- Required for built-in cards; shown in small text under the answer
- Translate the whole `back` sentence, mostly naturally, but prefer phrasing that keeps the drilled word's role visible ("to my brother", "with a pen", "a lot of time")
- Canadian spelling and vocabulary (colour, neighbour, centre; Mom, store, apartment)
- Keep plurals plural and mirror the Polish terminal punctuation
- Custom cards may leave it empty

### Declined
- Just the word that fills the blank, in its declined form
- Capitalized only if it starts the sentence

### Hint (Optional)
- Explains WHY this case is used
- Common patterns:
  - Preposition triggers: `"do" takes genitive`
  - Verb requirements: `"pomagać" requires dative`
  - Animate/inanimate distinction: `Animate masculine takes genitive form`
  - Special endings: `Exception using -a ending instead of -u for inanimate`
  - Grammar context: `Negation triggers genitive`

## Case Distribution

Good coverage should include all seven cases with various triggers:

### Nominative
- Subject of sentence
- After "to jest/to są"

### Genitive
- After negation (nie ma, nie widzę)
- After quantity words (dużo, mało, trochę, kilogram)
- After certain prepositions (do, od, z, bez, dla, obok, blisko, podczas, etc.)
- Possession (dom mojego brata)
- After genitive-governing verbs (szukać, potrzebować, unikać, etc.)

### Dative
- Indirect object (recipient)
- After dative-governing verbs (pomagać, dziękować, ufać, wierzyć, etc.)
- Impersonal expressions of feeling (jest mi zimno)
- After "dzięki", "przeciw"

### Accusative
- Direct object
- After motion prepositions (w, na, pod, za, przez, po)
- Duration expressions (cały dzień)

### Instrumental
- Means/tool (piszę długopisem)
- After "z" meaning "with"
- After "być" for professions (jest lekarzem)
- After prepositions (pod, nad, przed, między, za) for location
- Time expressions (nocą, wieczorem)
- After certain verbs (interesować się, zajmować się)

### Locative
- After "w", "na", "o", "przy" for static location
- "Mówić o" something

### Vocative
- Direct address
- Exclamations

## ID Format

IDs are sequential integers starting from 1. When generating new cards, check `declensionCardIndex.json` for the highest existing ID and continue from there.

## CLI Commands

```bash
# Review cards in a readable format (for manual review before import)
npm run declension:review <file.json>

# Import new cards from a JSON file
npm run declension:import <file.json>

# Sync local index from Firestore
npm run declension:sync

# Export cards (optionally filtered by case)
npm run declension:export [case]
```

## Generation Workflow

When requesting new declension cards from AI:

1. Share `declensionCardIndex.json` (or relevant portion for context)
2. Specify the target case(s) and any specific grammar patterns to focus on
3. AI generates cards in the correct JSON format
4. Save AI output to a file (e.g., `new-declension.json`)
5. Review with `npm run declension:review new-declension.json`
6. Run `npm run declension:import new-declension.json`

## Grammar Notes for AI Generation

### Masculine Animate vs Inanimate (Accusative)
- Animate masculine nouns take genitive form in accusative
- Inanimate masculine nouns keep nominative form

### Common Preposition Case Requirements

| Preposition | Case | Meaning |
|-------------|------|---------|
| do | Genitive | to (direction) |
| od | Genitive | from |
| z/ze | Genitive | from, out of |
| bez | Genitive | without |
| dla | Genitive | for |
| obok | Genitive | next to |
| podczas | Genitive | during |
| w/we | Accusative | into (motion) |
| w/we | Locative | in (static) |
| na | Accusative | onto (motion) |
| na | Locative | on (static) |
| pod | Accusative | under (motion) |
| pod | Instrumental | under (static) |
| z/ze | Instrumental | with |
| przed | Instrumental | in front of |
| między | Instrumental | between |
| o | Locative | about |
| przy | Locative | at, near |

### Verbs with Non-Accusative Objects

**Genitive:** szukać, potrzebować, używać, słuchać, unikać, bać się, pilnować, dotykać, żałować, wymagać

**Dative:** pomagać, dziękować, ufać, wierzyć, doradzać, przeszkadzać, gratulować, współczuć, zazdrościć

**Instrumental:** interesować się, zajmować się, kierować, władać

