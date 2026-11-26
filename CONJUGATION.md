# Verb Conjugation Documentation

This document describes the verb conjugation data structure and workflow for AI-assisted verb generation.

## Data Structure

Each verb has the following structure:

```typescript
interface ConjugationForm {
  pl: string;               // "piszę" — primary/canonical Polish form
  plAlternatives?: string[]; // Equivalent Polish forms (for imperfective future)
  en: string[];             // ["I write", "I am writing"] — all valid English translations
}

interface Verb {
  id: string;                      // e.g., "pisac" (ASCII-safe)
  infinitive: string;              // "pisać"
  infinitiveEn: string;            // "to write"
  aspect: Aspect;                  // "Imperfective" | "Perfective"
  aspectPair?: string;             // Foreign key to opposite aspect verb
  verbClass: VerbClass;            // "-ać" | "-ić" | "-yć" | "-eć" | "-ować" | "Irregular"
  isIrregular: boolean;
  isReflexive: boolean;
  isDefective?: boolean;           // True if verb lacks imperative (see Defective Verbs)
  isImpersonal?: boolean;          // True if verb only has 3rd person forms (see Impersonal Verbs)
  
  conjugations: {
    present?: Record<PresentFormKey, ConjugationForm>;      // Required for imperfective only
    past: Record<PastFormKey, ConjugationForm>;
    future: Record<FutureFormKey, ConjugationForm>;
    imperative?: Record<ImperativeFormKey, ConjugationForm>; // Omit for defective/impersonal verbs
    conditional: Record<ConditionalFormKey, ConjugationForm>;
  };
}

type Aspect = 'Imperfective' | 'Perfective';
type VerbClass = '-ać' | '-ić' | '-yć' | '-eć' | '-ować' | 'Irregular';

type PresentFormKey = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl';
type PastFormKey = '1sg_m' | '1sg_f' | '2sg_m' | '2sg_f' | '3sg_m' | '3sg_f' | '3sg_n' | '1pl_m' | '1pl_f' | '2pl_m' | '2pl_f' | '3pl_m' | '3pl_f';
type FutureFormKey = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl';
type ImperativeFormKey = '2sg' | '1pl' | '2pl';
type ConditionalFormKey = '1sg_m' | '1sg_f' | '2sg_m' | '2sg_f' | '3sg_m' | '3sg_f' | '3sg_n' | '1pl_m' | '1pl_f' | '2pl_m' | '2pl_f' | '3pl_m' | '3pl_f';
```

## Example Verb

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
      "1pl": { "pl": "piszemy", "en": ["we write", "we are writing"] },
      "2pl": { "pl": "piszecie", "en": ["you write", "you are writing"] },
      "3pl": { "pl": "piszą", "en": ["they write", "they are writing"] }
    },
    "past": {
      "1sg_m": { "pl": "pisałem", "en": ["I wrote", "I was writing"] },
      "1sg_f": { "pl": "pisałam", "en": ["I wrote", "I was writing"] },
      "2sg_m": { "pl": "pisałeś", "en": ["you wrote", "you were writing"] },
      "2sg_f": { "pl": "pisałaś", "en": ["you wrote", "you were writing"] },
      "3sg_m": { "pl": "pisał", "en": ["he wrote", "he was writing"] },
      "3sg_f": { "pl": "pisała", "en": ["she wrote", "she was writing"] },
      "3sg_n": { "pl": "pisało", "en": ["it wrote", "it was writing"] },
      "1pl_m": { "pl": "pisaliśmy", "en": ["we wrote", "we were writing"] },
      "1pl_f": { "pl": "pisałyśmy", "en": ["we wrote", "we were writing"] },
      "2pl_m": { "pl": "pisaliście", "en": ["you wrote", "you were writing"] },
      "2pl_f": { "pl": "pisałyście", "en": ["you wrote", "you were writing"] },
      "3pl_m": { "pl": "pisali", "en": ["they wrote", "they were writing"] },
      "3pl_f": { "pl": "pisały", "en": ["they wrote", "they were writing"] }
    },
    "future": {
      "1sg": { "pl": "będę pisać", "plAlternatives": ["będę pisał", "będę pisała"], "en": ["I will write", "I will be writing"] },
      "2sg": { "pl": "będziesz pisać", "plAlternatives": ["będziesz pisał", "będziesz pisała"], "en": ["you will write", "you will be writing"] },
      "3sg": { "pl": "będzie pisać", "plAlternatives": ["będzie pisał", "będzie pisała", "będzie pisało"], "en": ["will write", "will be writing"] },
      "1pl": { "pl": "będziemy pisać", "plAlternatives": ["będziemy pisali", "będziemy pisały"], "en": ["we will write", "we will be writing"] },
      "2pl": { "pl": "będziecie pisać", "plAlternatives": ["będziecie pisali", "będziecie pisały"], "en": ["you will write", "you will be writing"] },
      "3pl": { "pl": "będą pisać", "plAlternatives": ["będą pisali", "będą pisały"], "en": ["they will write", "they will be writing"] }
    },
    "imperative": {
      "2sg": { "pl": "pisz", "en": ["write!"] },
      "1pl": { "pl": "piszmy", "en": ["let's write!"] },
      "2pl": { "pl": "piszcie", "en": ["write!"] }
    },
    "conditional": {
      "1sg_m": { "pl": "pisałbym", "en": ["I would write", "I would be writing"] },
      "1sg_f": { "pl": "pisałabym", "en": ["I would write", "I would be writing"] },
      "2sg_m": { "pl": "pisałbyś", "en": ["you would write", "you would be writing"] },
      "2sg_f": { "pl": "pisałabyś", "en": ["you would write", "you would be writing"] },
      "3sg_m": { "pl": "pisałby", "en": ["he would write", "he would be writing"] },
      "3sg_f": { "pl": "pisałaby", "en": ["she would write", "she would be writing"] },
      "3sg_n": { "pl": "pisałoby", "en": ["it would write", "it would be writing"] },
      "1pl_m": { "pl": "pisalibyśmy", "en": ["we would write", "we would be writing"] },
      "1pl_f": { "pl": "pisałybyśmy", "en": ["we would write", "we would be writing"] },
      "2pl_m": { "pl": "pisalibyście", "en": ["you would write", "you would be writing"] },
      "2pl_f": { "pl": "pisałybyście", "en": ["you would write", "you would be writing"] },
      "3pl_m": { "pl": "pisaliby", "en": ["they would write", "they would be writing"] },
      "3pl_f": { "pl": "pisałyby", "en": ["they would write", "they would be writing"] }
    }
  }
}
```

## English Translation Guidelines

| Aspect | Tense | English translations | Example |
|--------|-------|---------------------|---------|
| Imperfective | Present | Simple + Progressive | "I write" / "I am writing" |
| Imperfective | Past | Simple + Progressive | "I wrote" / "I was writing" |
| Imperfective | Future | Simple + Progressive | "I will write" / "I will be writing" |
| Perfective | Past | Simple + Present perfect | "I wrote" / "I have written" |
| Perfective | Future | Simple only | "I will write" |
| Any | Imperative | Command with "!" | "write!" / "let's write!" |
| Any | Conditional | "would" forms | "I would write" |

### 3sg Non-Gendered Forms

For 3sg present and future (non-gendered), store only the verb without subject pronoun:

```json
{ "pl": "pisze", "en": ["writes", "is writing"] }
```

The app prepends "he/she/it" for display. Past/conditional 3sg forms ARE gendered and include the pronoun:

```json
"3sg_m": { "pl": "pisał", "en": ["he wrote", "he was writing"] }
"3sg_f": { "pl": "pisała", "en": ["she wrote", "she was writing"] }
"3sg_n": { "pl": "pisało", "en": ["it wrote", "it was writing"] }
```

## Imperfective Future Alternatives

Imperfective verbs have two equivalent future forms:

| Form | Example | Notes |
|------|---------|-------|
| **będę + infinitive** | będę pisać | Gender-neutral, primary form |
| **będę + l-participle** | będę pisał (m) / będę pisała (f) | Gendered variants |

Store infinitive form as `pl`, participle variants in `plAlternatives`:

```json
{
  "1sg": {
    "pl": "będę pisać",
    "plAlternatives": ["będę pisał", "będę pisała"],
    "en": ["I will write", "I will be writing"]
  }
}
```

**Required:** All imperfective future forms MUST include `plAlternatives`.

## Reflexive Verbs

Polish forms always include "się". Use natural English translations:

**Reflexive in both languages:**
```
myć się → { pl: "myję się", en: ["I wash myself", "I am washing myself"] }
```

**Polish reflexive, English non-reflexive:**
```
uczyć się → { pl: "uczę się", en: ["I learn", "I am learning"] }  // NOT "I teach myself"
bać się → { pl: "boję się", en: ["I am afraid", "I fear"] }
śmiać się → { pl: "śmieję się", en: ["I laugh", "I am laughing"] }
```

## Defective and Impersonal Verbs

Some verbs lack certain conjugations due to semantic or grammatical constraints:

| Flag | Use for | What's missing |
|------|---------|----------------|
| `isDefective` | Modal verbs (móc, musieć) | Imperative only |
| `isImpersonal` | Weather/state verbs (padać, brakować) | 1st/2nd person + imperative |

These flags are independent — a verb could theoretically be both (though rare in practice).

### Types of Defective Verbs

#### 1. Modal Verbs (missing imperatives)

Verbs like **móc** (can) and **musieć** (must) don't have natural imperative forms — you can't command someone "to be able to" or "to have to" do something.

**What to do:**
- Set `"isDefective": true`
- Omit the `imperative` key entirely
- Include all other conjugations normally

```json
{
  "id": "moc",
  "infinitive": "móc",
  "infinitiveEn": "can",
  "isDefective": true,
  "conjugations": {
    "present": { ... },
    "past": { ... },
    "future": { ... },
    "conditional": { ... }
    // NO imperative key
  }
}
```

**Note:** Some modal-like verbs DO have imperatives:
- **chcieć** (to want) → "chciej!" is used idiomatically
- **wiedzieć** (to know) → "wiedz!" exists (formal/literary)
- **mieć** (to have) → "miej!" is common ("Miej się dobrze!")

Only mark as defective if the imperative truly doesn't exist or makes no sense.

#### 2. Impersonal Verbs (3rd person only)

Weather verbs and some state verbs only conjugate in 3rd person:

- **padać** (to rain) → tylko "pada", "padało", "będzie padać"
- **śnieżyć** (to snow) → tylko "śnieży", "śnieżyło"
- **brakować** (to lack) → tylko "brakuje"

**What to do:** 
- Set `"isImpersonal": true`
- Include only 3rd person forms (3sg, 3pl, 3sg_m/f/n, 3pl_m/f)
- Omit the `imperative` key (impersonal verbs can't be commanded)

```json
{
  "id": "padac",
  "infinitive": "padać",
  "infinitiveEn": "to rain/fall",
  "aspect": "Imperfective",
  "verbClass": "-ać",
  "isIrregular": false,
  "isReflexive": false,
  "isImpersonal": true,
  "conjugations": {
    "present": {
      "3sg": { "pl": "pada", "en": ["rains", "is raining"] },
      "3pl": { "pl": "padają", "en": ["they fall", "they are falling"] }
    },
    "past": {
      "3sg_m": { "pl": "padał", "en": ["it rained", "it was raining"] },
      "3sg_f": { "pl": "padała", "en": ["it rained", "it was raining"] },
      "3sg_n": { "pl": "padało", "en": ["it rained", "it was raining"] },
      "3pl_m": { "pl": "padali", "en": ["they fell"] },
      "3pl_f": { "pl": "padały", "en": ["they fell"] }
    },
    "future": {
      "3sg": { "pl": "będzie padać", "plAlternatives": ["będzie padało"], "en": ["will rain"] },
      "3pl": { "pl": "będą padać", "plAlternatives": ["będą padały"], "en": ["they will fall"] }
    },
    "conditional": {
      "3sg_m": { "pl": "padałby", "en": ["it would rain"] },
      "3sg_f": { "pl": "padałaby", "en": ["it would rain"] },
      "3sg_n": { "pl": "padałoby", "en": ["it would rain"] },
      "3pl_m": { "pl": "padaliby", "en": ["they would fall"] },
      "3pl_f": { "pl": "padałyby", "en": ["they would fall"] }
    }
  }
}
```

#### 3. Perfective Verbs (no present tense)

Perfective verbs don't have present tense — their conjugated forms express future meaning.

**What to do:**
- Omit the `present` key for perfective verbs
- The validation already handles this (present is only required for imperfective)

## Aspect Pairs

Both verbs in an aspect pair **must be in the same import file** with matching cross-references:

```json
[
  { "id": "pisac", "aspectPair": "napisac", ... },
  { "id": "napisac", "aspectPair": "pisac", ... }
]
```

Import will fail if:
- A verb references an `aspectPair` not in the file
- Cross-references don't match (A→B but B doesn't point to A)

## Verb Classes

| Class | Pattern | Example |
|-------|---------|---------|
| -ać | czytać → czytam | Regular, most common |
| -ić | robić → robię | Soft stem |
| -yć | myć → myję | Similar to -ić |
| -eć | umieć → umiem | -em/-esz pattern |
| -ować | pracować → pracuję | Drop -ow-, add -uj- |
| Irregular | być → jestem | Must memorize |

## CLI Commands

```bash
# Validate verb data without importing
npm run verbs:validate <file.json>

# Import verbs to Firestore
npm run verbs:import <file.json>

# Sync local index from Firestore
npm run verbs:sync

# Export verbs for review/editing
npm run verbs:export [filters]
```

## Validation Rules

The import validates:

| Rule | Description |
|------|-------------|
| **No duplicate `id`** | ID must not exist in `verbIndex.json` |
| **No duplicate `infinitive`** | Infinitive must not exist in index |
| **Required tenses** | `past`, `future`, `conditional` always required |
| **Present for imperfective** | Imperfective verbs must have `present` |
| **Imperative for non-defective** | Non-defective/non-impersonal verbs must have `imperative` |
| **No imperative for defective/impersonal** | Defective and impersonal verbs must NOT have `imperative` |
| **3rd person only for impersonal** | Impersonal verbs only need 3sg/3pl forms (1st/2nd person omitted) |
| **`plAlternatives` for imperfective future** | Required for all imperfective future forms |
| **Valid enum values** | `aspect`, `verbClass` must match allowed values |
| **Aspect pair completeness** | Both verbs must be in same import file |
| **Aspect pair cross-reference** | A→B requires B→A |

## Generation Workflow

1. Check `verbIndex.json` for existing verbs to avoid duplicates
2. Generate complete verb objects with ALL required conjugation forms
3. For aspect pairs, generate BOTH verbs together
4. Save output to file (e.g., `new-verbs.json`)
5. Run `npm run verbs:validate new-verbs.json`
6. Run `npm run verbs:import new-verbs.json`

## ID Format

Use ASCII-safe versions of the infinitive:
- pisać → `pisac`
- móc → `moc`
- być → `byc`
- myć się → `myc-sie`
