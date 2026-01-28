# Conjugation Driller Feature Plan

This document outlines the requirements and design decisions for adding a verb conjugation drilling feature to Polingu.

## Overview

An English ↔ Polish translation-based flashcard system for practicing Polish verb conjugations. The verbs collection serves as the single source of truth, storing all conjugated forms with translations. Uses FSRS spaced repetition for optimal learning.

**Key difference from declension:** No fill-in-the-blank sentences. Instead, direct translation drilling:
```
Front: "I write / I am writing"
Back: "piszę"
```

**Multiple English translations:** The `en` field stores all valid translations as an array. All are displayed on cards; any is accepted as a correct answer.

| Aspect | Tense | English translations | Example |
|--------|-------|---------------------|---------|
| Imperfective | Present | Simple + Progressive | "I write" / "I am writing" |
| Imperfective | Past | Simple + Progressive | "I wrote" / "I was writing" |
| Imperfective | Future | Simple + Progressive | "I will write" / "I will be writing" |
| Perfective | Past | Simple past + Present perfect | "I wrote" / "I have written" |
| Perfective | Future | Simple only | "I will write" |

**Note for AI content generation:** Perfective past forms should include BOTH simple past ("I wrote") and present perfect ("I have written") translations, as both emphasize the completion that perfective aspect conveys.

**Why no past perfect ("I had written")?** Polish perfective past technically covers past perfect meaning too—"napisałem" can mean "I wrote", "I have written", OR "I had written" depending on context. However, since this driller is context-free (no surrounding sentence), including past perfect would be misleading. It would suggest Polish has a distinct past perfect conjugation, which it doesn't. Past perfect translations would only make sense in sentence-based drilling where temporal context (e.g., "before I left...") clarifies the meaning.

---

## Data Model

### Verbs Collection (Single Source of Truth)

The `verbs` collection stores all verb data including every conjugated form. This eliminates the need for separate "card" entities - the verb data IS the drill content.

```typescript
interface ConjugationForm {
  pl: string;               // "piszę" — primary/canonical Polish form
  plAlternatives?: string[]; // Equivalent Polish forms (see "Imperfective Future Alternatives")
  en: string[];             // ["I write", "I am writing"] — all valid English translations
}

interface Verb {
  id: string;                      // e.g., "pisac"
  infinitive: string;              // "pisać"
  infinitiveEn: string;            // "to write"
  aspect: Aspect;                  // "Imperfective" | "Perfective"
  aspectPair?: string;             // Foreign key to opposite aspect verb
  verbClass: VerbClass;            // "-ać" | "-ić" | "-yć" | "-eć" | "-ować" | "Irregular"
  isIrregular: boolean;
  isReflexive: boolean;
  
  conjugations: {
    present: {
      '1sg': ConjugationForm;      // { pl: "piszę", en: ["I write", "I am writing"] }
      '2sg': ConjugationForm;      // { pl: "piszesz", en: ["you write", "you are writing"] }
      '3sg': ConjugationForm;      // { pl: "pisze", en: ["writes", "is writing"] } — see "3sg Handling"
      '1pl': ConjugationForm;      // { pl: "piszemy", en: ["we write", "we are writing"] }
      '2pl': ConjugationForm;      // { pl: "piszecie", en: ["you write", "you are writing"] }
      '3pl': ConjugationForm;      // { pl: "piszą", en: ["they write", "they are writing"] }
    };
    past: {
      '1sg_m': ConjugationForm;    // { pl: "pisałem", en: ["I wrote", "I was writing"] }
      '1sg_f': ConjugationForm;    // { pl: "pisałam", en: ["I wrote", "I was writing"] }
      '2sg_m': ConjugationForm;    // { pl: "pisałeś", en: ["you wrote", "you were writing"] }
      '2sg_f': ConjugationForm;    // { pl: "pisałaś", en: ["you wrote", "you were writing"] }
      '3sg_m': ConjugationForm;    // { pl: "pisał", en: ["he wrote", "he was writing"] }
      '3sg_f': ConjugationForm;    // { pl: "pisała", en: ["she wrote", "she was writing"] }
      '3sg_n': ConjugationForm;    // { pl: "pisało", en: ["it wrote", "it was writing"] }
      '1pl_m': ConjugationForm;    // { pl: "pisaliśmy", en: ["we wrote", "we were writing"] }
      '1pl_f': ConjugationForm;    // { pl: "pisałyśmy", en: ["we wrote", "we were writing"] }
      '2pl_m': ConjugationForm;    // { pl: "pisaliście", en: ["you wrote", "you were writing"] }
      '2pl_f': ConjugationForm;    // { pl: "pisałyście", en: ["you wrote", "you were writing"] }
      '3pl_m': ConjugationForm;    // { pl: "pisali", en: ["they wrote", "they were writing"] }
      '3pl_f': ConjugationForm;    // { pl: "pisały", en: ["they wrote", "they were writing"] }
    };
    future: {
      // For perfective: same forms as present (napiszę, napiszesz, etc.)
      // For imperfective: compound with infinitive as primary, participle variants in plAlternatives
      '1sg': ConjugationForm;  // Imperfective: { pl: "będę pisać", plAlternatives: ["będę pisał", "będę pisała"], en: [...] }
      '2sg': ConjugationForm;  // Imperfective: { pl: "będziesz pisać", plAlternatives: ["będziesz pisał", "będziesz pisała"], en: [...] }
      '3sg': ConjugationForm;  // Imperfective: { pl: "będzie pisać", plAlternatives: ["będzie pisał", "będzie pisała", "będzie pisało"], en: [...] }
      '1pl': ConjugationForm;  // Imperfective: { pl: "będziemy pisać", plAlternatives: ["będziemy pisali", "będziemy pisały"], en: [...] }
      '2pl': ConjugationForm;  // Imperfective: { pl: "będziecie pisać", plAlternatives: ["będziecie pisali", "będziecie pisały"], en: [...] }
      '3pl': ConjugationForm;  // Imperfective: { pl: "będą pisać", plAlternatives: ["będą pisali", "będą pisały"], en: [...] }
    };
    imperative: {
      '2sg': ConjugationForm;      // { pl: "pisz", en: ["write!"] }
      '1pl': ConjugationForm;      // { pl: "piszmy", en: ["let's write!"] }
      '2pl': ConjugationForm;      // { pl: "piszcie", en: ["write!"] }
    };
    conditional: {
      '1sg_m': ConjugationForm;    // { pl: "pisałbym", en: ["I would write", "I would be writing"] }
      '1sg_f': ConjugationForm;    // { pl: "pisałabym", en: ["I would write", "I would be writing"] }
      // ... same gender pattern as past
    };
  };
}
```

**Key points:**
- `pl` is the primary/canonical Polish form
- `plAlternatives` stores equivalent Polish forms that are also accepted as correct answers (see "Imperfective Future Alternatives" below)
- `en` is an array because Polish imperfective forms map to multiple English translations (simple vs progressive: "I write" / "I am writing")
- English translations do NOT include gender indicators — gender shown via UI
- 3sg non-gendered forms store only the verb (e.g., `["writes", "is writing"]`) — app code handles "he/she/it" display and validation (see "3sg Handling")
- Imperative uses "!" in English (e.g., "write!", "let's write!")
- Reflexive verbs include "się" in Polish forms (e.g., "myję się")
- Aspect pair verb linked for cross-reference

### Review Data Store

Since cards are derived from verb forms, review data keys on verb + form combination:

```typescript
type ConjugationFormKey = string;  // e.g., "pisac:present:1sg" or "pisac:past:1sg_m"

interface ConjugationReviewDataStore {
  forms: Record<ConjugationFormKey, ConjugationFormReviewData>;
  reviewedToday: ConjugationFormKey[];
  newFormsToday: ConjugationFormKey[];
  lastReviewDate: string;
}

interface ConjugationFormReviewData {
  formKey: ConjugationFormKey;
  fsrsCard: FSRSCard;
  log?: ReviewLog;
}

interface ConjugationSettings {
  newCardsPerDay: number;
}
```

---

## Bi-Directional Support

Like the vocabulary feature, conjugation supports two directions:

| Direction | Front | Back |
|-----------|-------|------|
| **en-to-pl** | "I write / I am writing" | "piszę" |
| **pl-to-en** | "piszę" | "I write / I am writing" |

Each direction has its own:
- Review data store
- Settings (newCardsPerDay)
- Session queue

### Answer Validation

```typescript
function checkAnswer(
  userAnswer: string, 
  form: ConjugationForm, 
  direction: 'en-to-pl' | 'pl-to-en'
): boolean {
  const normalize = (s: string) => 
    s.toLowerCase().trim().replace(/[.,!?]/g, '');
  
  if (direction === 'en-to-pl') {
    // User sees English options, types Polish — one correct answer
    return normalize(userAnswer) === normalize(form.pl);
  } else {
    // User sees Polish, types English — accept ANY valid translation
    return form.en.some(
      valid => normalize(userAnswer) === normalize(valid)
    );
  }
}
```

---

## Filter System

Six filters available:

| Filter | Type | Values |
|--------|------|--------|
| **Tense** | Multi-select | Present, Past, Future, Imperative, Conditional |
| **Person** | Multi-select | 1st, 2nd, 3rd |
| **Number** | Single-select | All, Singular, Plural |
| **Aspect** | Multi-select | Perfective, Imperfective |
| **Verb Class** | Multi-select | -ać, -ić, -yć, -eć, -ować, Irregular |
| **Gender** | Multi-select | Masculine, Feminine, Neuter |

Gender filter only shows forms where gender applies (past, conditional, some future).

**Filter behavior (consistent with other features):** Filters only affect which NEW cards are introduced. Due reviews are always shown regardless of filter settings — you can't hide cards you've already started learning.

---

## UI Requirements

### Flashcard Display

**Front of card shows:**
- Translation text (English or Polish based on direction)
  - For en-to-pl: All English alternatives displayed (e.g., "I write / I am writing")
  - For pl-to-en: Single Polish form
- Infinitive reference (e.g., "pisać" shown small)
- Tense badge
- Person/number badge (disambiguates 2sg vs 2pl "you" — NOT baked into text)
- Gender badge (when applicable, NOT baked into text)

**Back of card shows:**
- Answer text
  - For en-to-pl: Single Polish form
  - For pl-to-en: All English alternatives displayed
- All metadata chips: tense, person, number, aspect, verb class
- Gender chip when applicable
- "Irregular" indicator if verb is irregular
- Aspect pair form (e.g., "Perfective: napiszę")
- Infinitive with English translation

### Direction Toggle

Toggle between en-to-pl and pl-to-en (same pattern as vocabulary).

### Filter Controls

- Collapsible filter panel
- Badge showing active filter count
- Chips showing active filters with remove option
- Clear all button

### Practice Mode

A non-FSRS drill mode (consistent with other features on the site):
- Use the existing `PracticeModeButton` component to toggle between Review Mode and Practice Mode
- In Practice Mode:
  - All filters apply to card selection (not just new cards)
  - Cards presented in random order
  - No review data is saved — responses don't affect FSRS scheduling
  - Unlimited drilling through filtered card pool
- Useful for focused practice on specific tenses, verb classes, or other combinations without affecting spaced repetition progress

### Cheat Sheet

Reference tables showing conjugation patterns by verb class and tense.

---

## Conjugation Coverage

### Tenses and Form Counts

| Tense | Forms per verb | Gender? |
|-------|----------------|---------|
| Present | 6 | No |
| Past | 13 | Yes |
| Future (perfective) | 6 | No |
| Future (imperfective) | 6 | No (gendered variants stored as `plAlternatives`) |
| Imperative | 3 | No |
| Conditional | 13 | Yes |

### Verb Classes

| Class | Pattern | Example |
|-------|---------|---------|
| -ać | czytać → czytam | Regular, most common |
| -ić | robić → robię | Soft stem |
| -yć | myć → myję | Similar to -ić |
| -eć | umieć → umiem | -em/-esz pattern |
| -ować | pracować → pracuję | Drop -ow-, add -uj- |
| Irregular | być → jestem | Must memorize |

---

## Special Cases

### Reflexive Verbs

Polish forms always include "się". English translations should be natural — include reflexive pronouns only when they fit idiomatically:

**Reflexive in both languages:**
```
myć się → { pl: "myję się", en: ["I wash myself", "I am washing myself"] }
golić się → { pl: "golę się", en: ["I shave", "I am shaving"] }  // "myself" optional, often omitted
```

**Polish reflexive, English non-reflexive:**
```
uczyć się → { pl: "uczę się", en: ["I learn", "I am learning"] }  // NOT "I teach myself"
bać się → { pl: "boję się", en: ["I am afraid", "I fear"] }  // NOT "I fear myself"
śmiać się → { pl: "śmieję się", en: ["I laugh", "I am laughing"] }  // NOT "I laugh at myself"
starać się → { pl: "staram się", en: ["I try", "I am trying"] }  // NOT "I try myself"
```

**AI content generation note:** Use natural English translations. If the reflexive meaning carries over naturally (washing, dressing, introducing oneself), include the reflexive pronoun. If Polish uses "się" idiomatically but English doesn't need it, omit it.

### Imperative Forms

English uses "!" to indicate command. Imperative typically has only one English form:
```
{ pl: "pisz", en: ["write!"] }
{ pl: "piszmy", en: ["let's write!"] }
{ pl: "piszcie", en: ["write!"] }  // plural "you"
```

### Imperfective Future Alternatives

Polish imperfective verbs have **two equivalent ways** to form the future tense:

| Form | Example | Notes |
|------|---------|-------|
| **będę + infinitive** | będę pisać | Gender-neutral, slightly more formal |
| **będę + l-participle** | będę pisał (m) / będę pisała (f) | Gendered, common in everyday speech |

Both forms are grammatically correct and interchangeable in meaning. Rather than storing these as separate drillable forms (which would triple the card count), we store them as alternatives:

**Data structure:**
```json
{
  "1sg": {
    "pl": "będę pisać",
    "plAlternatives": ["będę pisał", "będę pisała"],
    "en": ["I will write", "I will be writing"]
  }
}
```

**UI behavior:**
| Direction | Front | Back |
|-----------|-------|------|
| en-to-pl | "I will write" | "będę pisać" (primary shown prominently, alternatives shown smaller) |
| pl-to-en | "będę pisać / będę pisał / będę pisała" | "I will write" |

**Answer validation:** Any of `pl` or `plAlternatives` is accepted as correct.

**Why this approach:**
- 6 forms instead of 18 (simpler drill set)
- All valid answers accepted
- Clear primary form for teaching ("będę pisać" is the neutral/standard form)
- Gendered participle forms still taught via display

**AI content generation note:** When generating verb data, imperfective future forms MUST include `plAlternatives` with the l-participle variants. The masculine participle drops the infinitive ending and adds the appropriate l-participle suffix; feminine adds -a; neuter adds -o; plural masculine uses -li; plural non-masculine uses -ły.

### Past Tense Gender

Gender shown via UI badge, not in English text:
```
Form key: "jesc:past:1sg_m"
Display: "I ate" with [Masculine] badge
Polish: "jadłem"
```

### 3sg Handling (Non-Gendered Forms)

For 3sg forms without gender distinction (present, future), store only the verb without subject pronoun:

**Data storage:**
```
{ pl: "pisze", en: ["writes", "is writing"] }
```

**Display:** Application code prepends "he/she/it" for card display:
```
Card shows: "he/she/it writes / is writing"
```

**Answer validation:** Accept any valid subject + verb combination:
```typescript
const THIRD_PERSON_SUBJECTS = ['he', 'she', 'it', ''];  // empty = no subject

function validate3sgAnswer(userAnswer: string, storedVerbs: string[]): boolean {
  const normalized = userAnswer.toLowerCase().trim();
  
  for (const verb of storedVerbs) {
    for (const subject of THIRD_PERSON_SUBJECTS) {
      const expected = subject ? `${subject} ${verb}` : verb;
      if (normalized === expected) return true;
    }
  }
  return false;
}

// Accepts: "writes", "he writes", "she writes", "it writes",
//          "is writing", "he is writing", "she is writing", "it is writing"
```

**Why this approach:**
- Avoids storing 8 translations per 3sg form
- Keeps data clean and consistent
- Centralizes display/validation logic in one place

**Note:** Past tense 3sg already has separate gendered forms (3sg_m, 3sg_f, 3sg_n), so those store the full translation (e.g., "he wrote", "she wrote", "it wrote").

### Prefix Verbs

Prefix verbs (pisać, napisać, przepisać, zapisać) are separate entries in the verbs collection.

**Future feature:** Dedicated system for learning prefix verb families and their semantic differences.

### Aspect Pairs

**Each verb is drilled independently.** Imperfective and perfective verbs are separate entries with their own review data. Reviewing one verb does NOT affect the review schedule of its aspect pair. Drilling aspect pairs together (e.g., practicing pisać/napisać as a unit) is a future feature, not part of this conjugation driller.

The only aspect pair integration is **display-only**: the answer side of the card shows the equivalent form from the paired verb as extra reference info:
```
Drilling: "I write / I am writing" → "piszę" (imperfective)
Answer card shows: "Perfective: napiszę" (informational only)
```

Note: Their English translations may overlap (e.g., both "I will write"), but disambiguation comes from the infinitive reference and aspect badge shown on the card.

---

## Architecture Benefits

This approach provides:

1. **Single source of truth** - All conjugation data in verbs collection
2. **No separate cards** - Forms derived directly from verb data
3. **Easy maintenance** - Fix a conjugation once, fixed everywhere
4. **Scalable** - Add a verb, all forms immediately available
5. **Reusable** - Same verb data can power future features:
   - Sentence generation with correct verb forms
   - Grammar explanations
   - Verb family exploration

---

## CLI Tools

### Commands

| Command | Description |
|---------|-------------|
| `verbs:import <file.json>` | Validate and import verb definitions to Firestore |
| `verbs:export [filters]` | Export verbs for review/editing |
| `verbs:sync` | Sync local `verbIndex.json` from Firestore |
| `verbs:validate <file.json>` | Validate verb data without importing |

### Local Index File

`verbIndex.json` stores a simple array of existing verb infinitives for duplicate checking:

```json
["pisać", "napisać", "czytać", "przeczytać", "robić", "zrobić"]
```

### Import Validation Rules

The `verbs:import` command validates all of the following before writing to Firestore:

| Rule | Description |
|------|-------------|
| **No duplicate `id`** | Verb ID must not exist in `verbIndex.json` |
| **No duplicate `infinitive`** | Infinitive must not exist in `verbIndex.json` |
| **All tenses present** | `present`, `past`, `future`, `imperative`, `conditional` required |
| **All forms per tense** | Each tense must have all required person/gender forms |
| **`plAlternatives` for imperfective future** | Imperfective verbs must include participle alternatives in future forms |
| **Valid enum values** | `aspect` must be "Imperfective" or "Perfective"; `verbClass` must match allowed values |
| **Aspect pairs complete** | Both verbs in an aspect pair must be in the same import file |
| **Aspect pairs cross-reference** | If A's `aspectPair` is B, then B's `aspectPair` must be A |

If any validation fails, the entire import is aborted with specific error messages.

### Aspect Pair Handling

Both verbs in an aspect pair **must be included in the same import file**. The import will fail if:
- A verb references an `aspectPair` that isn't in the import
- The cross-reference doesn't match (A→B but B doesn't point back to A)

**Valid import:**
```json
[
  { "id": "pisac", "infinitive": "pisać", "aspect": "Imperfective", "aspectPair": "napisac", ... },
  { "id": "napisac", "infinitive": "napisać", "aspect": "Perfective", "aspectPair": "pisac", ... }
]
```

**Invalid import (will fail):**
```json
[
  { "id": "pisac", "infinitive": "pisać", "aspectPair": "napisac", ... }
  // Missing "napisac" - import fails
]
```

### Data Format for Import

```json
{
  "id": "pisac",
  "infinitive": "pisać",
  "infinitiveEn": "to write",
  "aspect": "Imperfective",
  "aspectPair": "napisac",
  "verbClass": "-ać",
  "isIrregular": false,
  "isReflexive": false,
  "conjugations": {
    "present": {
      "1sg": { "pl": "piszę", "en": ["I write", "I am writing"] },
      "2sg": { "pl": "piszesz", "en": ["you write", "you are writing"] },
      "3sg": { "pl": "pisze", "en": ["writes", "is writing"] },
      ...
    },
    "past": {
      "1sg_m": { "pl": "pisałem", "en": ["I wrote", "I was writing"] },
      "3sg_m": { "pl": "pisał", "en": ["he wrote", "he was writing"] },
      "3sg_f": { "pl": "pisała", "en": ["she wrote", "she was writing"] },
      "3sg_n": { "pl": "pisało", "en": ["it wrote", "it was writing"] },
      ...
    },
    "future": {
      "1sg": { 
        "pl": "będę pisać", 
        "plAlternatives": ["będę pisał", "będę pisała"],
        "en": ["I will write", "I will be writing"] 
      },
      ...
    },
    ...
  }
}
```

---

## Generation Workflow

When requesting new verb data from AI:

1. Share existing `verbIndex.json` to avoid duplicates
2. Specify target verbs by infinitive (e.g., "Generate data for: jeść, pić, spać")
3. AI generates complete verb objects with ALL conjugation forms
4. **AI automatically includes aspect pairs** — if you request "pisać", AI should generate both "pisać" (imperfective) and "napisać" (perfective) with full conjugations
5. Save AI output to file (e.g., `new-verbs.json`)
6. Run `npm run verbs:validate new-verbs.json` to check for errors
7. Run `npm run verbs:import new-verbs.json`

### AI Prompt Guidelines

When prompting AI to generate verb data, remind it:

- **Provide the TypeScript interfaces** from this document for reference
- **Imperfective future**: Must include `plAlternatives` with participle variants
- **Perfective past**: Must include both simple past AND present perfect in `en` array (e.g., `["I wrote", "I have written"]`)
- **Imperfective past**: Must include both simple past AND past progressive (e.g., `["I wrote", "I was writing"]`)
- **3sg non-gendered forms**: Store only the verb without "he/she/it" (e.g., `["writes", "is writing"]`)
- **Aspect pairs**: Always generate both verbs in the pair together
- **Cross-reference**: Ensure `aspectPair` fields point to each other correctly

---

## Paradigm Reference Data

Create `conjugationPatterns.ts` with:
- Ending patterns by verb class and tense
- Stem modification rules
- Example verbs for each pattern

This powers the cheat sheet UI.

---

## Dashboard Integration

Add conjugation as a fourth feature card:
- Path: `/conjugation`
- Icon: TBD (verb-related)
- Color: TBD (unused palette color)
- Stats: Due count per direction, learned/total progress

---

---

## Context Refactoring (Prerequisite)

Before implementing conjugation, refactor `ReviewDataContext.tsx` (currently ~690 lines) into feature-specific contexts. This improves maintainability and prevents the single context from growing further.

### New Context Structure

```
src/contexts/
├── review/
│   ├── DeclensionContext.tsx      # Declension cards, review store, settings
│   ├── VocabularyContext.tsx      # Vocabulary words, review stores (both directions), settings
│   ├── SentenceContext.tsx        # Sentences, review stores, settings, tags
│   ├── ConjugationContext.tsx     # NEW: Verbs, review stores, settings
│   ├── ReviewCountsContext.tsx    # Aggregated counts from all features
│   └── index.ts                   # Re-exports and combined provider
```

### Context Responsibilities

| Context | State | Operations |
|---------|-------|------------|
| **DeclensionContext** | cards (custom + system), reviewStore, settings | updateReviewStore, updateSettings, clearData, setCustomCards, setSystemCards |
| **VocabularyContext** | words (custom + system), reviewStores (per direction), settings | updateReviewStore, updateSettings, clearData, refreshWords, setCustomWords, setSystemWords |
| **SentenceContext** | sentences (custom + system), reviewStores (per direction), settings, tags | updateReviewStore, updateSettings, clearData, setSentences, addTag, removeTag |
| **ConjugationContext** | verbs, reviewStores (per direction), settings | updateReviewStore, updateSettings, clearData |
| **ReviewCountsContext** | counts: { declension, vocabulary, sentences, conjugation } | Computed from other contexts |

### Combined Provider

```typescript
// src/contexts/review/index.ts
export function ReviewDataProvider({ children }: { children: ReactNode }) {
  return (
    <DeclensionProvider>
      <VocabularyProvider>
        <SentenceProvider>
          <ConjugationProvider>
            <ReviewCountsProvider>
              {children}
            </ReviewCountsProvider>
          </ConjugationProvider>
        </SentenceProvider>
      </VocabularyProvider>
    </DeclensionProvider>
  );
}
```

### Migration Strategy

1. Create new context files with extracted logic
2. Update imports in consuming components
3. Keep the combined `ReviewDataProvider` export for minimal app-level changes
4. Add `ConjugationContext` as part of Phase 1

---

## Implementation Phases

### Phase 1: Core Infrastructure
- **Context refactoring** (split ReviewDataContext into feature contexts)
- Types and interfaces
- Verbs collection schema
- Storage layer (review data by form key, settings)
- Scheduler functions (derive drillable forms from verb data)

### Phase 2: UI Components
- ConjugationFlashcard component
- ConjugationFilterControls (6 filters)
- ConjugationPage with direction toggle and PracticeModeButton
- Cheat sheet components

### Phase 3: Data & Tools
- CLI scripts for verb management
- Initial verb data (Tier 1-2 verbs with all conjugations)
- Paradigm reference data

### Phase 4: Polish & Integration
- Dashboard integration
- Context updates for counts
- Testing and refinement

---

## Non-Goals (For Now)

- Fill-in-the-blank sentence mode
- Aspect pair drilling as separate feature
- Full paradigm completion mode
- Prefix verb learning system
- Audio pronunciation
