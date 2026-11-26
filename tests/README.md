# Tests

| Command              | Runs                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `npm test`           | App unit tests (`tests/`, except `tests/rules/`) and `functions/tests/` |
| `npm run test:watch` | The same, in watch mode                                                 |
| `npm run test:rules` | Firestore and Storage security rules, against the local emulators       |
| `npm run test:types` | Type-checks all test files                                              |

CI runs all four before every deploy; a failure stops the deploy.

## Layout

| Folder               | Covers                                                                       |
| -------------------- | ---------------------------------------------------------------------------- |
| `tests/scheduling/`  | Schedulers, `fsrsUtils`, `reviewSession`, pure utilities                     |
| `tests/content/`     | Invariants of the built-in content data checked into the repo                |
| `tests/sync/`        | `offlineDb` and `storage`: IndexedDB, Firestore writes, offline sync         |
| `tests/contexts/`    | Review contexts: loading, background sync, saving stores, resets, badges     |
| `tests/hooks/`       | React hooks, rendered with `renderHook`                                      |
| `tests/translation/` | Tap-to-translate, phrase selection, the translator and translation callables |
| `tests/media/`       | Client audio and reader libraries: uploads, caches, books, rating feedback   |
| `tests/playback/`    | Audio player, listening sessions, audio library and their pages              |
| `tests/ui/review/`   | The study pages, rendered in the app's providers: decks, rating, dashboard   |
| `tests/ui/content/`  | Custom content, library and reader, app shell, settings, admin pages         |
| `tests/rules/`       | `firestore.rules` and `storage.rules` (emulator only)                        |
| `functions/tests/`   | Cloud Functions logic                                                        |
| `tests/helpers/`     | Shared fixtures (`fsrsCard`, `inDays`, `stub`)                               |

Folders with a `support/` subfolder keep their own fakes and render helpers there
(for example `tests/sync/support/fakeFirestore.ts`, an in-memory Firestore that
several other folders reuse).

## Rules of the road

- **Firebase is faked.** `tests/setup/unit.ts` replaces `src/lib/firebase.ts` with
  `tests/fakes/firebase.ts`, whose handles are inert. Code that calls the Firebase SDK
  needs `vi.mock('firebase/firestore', ...)` (or `firebase/storage`, `firebase/functions`)
  in the test. Use `signInFakeUser()` to set `auth.currentUser`.
- **No network.** `fetch` throws unless a test stubs it with `vi.stubGlobal`.
- **IndexedDB is in memory** (`fake-indexeddb`), so Dexie works in tests.
- **Time zone is `America/Toronto`** in every run. Freeze the clock with
  `vi.useFakeTimers()` and `vi.setSystemTime(...)` for anything that depends on "today".
  Fake only the timers you need (for example `{ toFake: ['Date', 'setTimeout'] }`):
  faking `setImmediate` stalls the in-memory IndexedDB.
- **Rules tests use the `demo-polingu` project id.** The `demo-` prefix keeps the
  emulators fully offline, so these tests can never touch production.
- **A test that exposes a real bug** is written as `test.fails(...)` with a `// BUG:`
  comment explaining it. It passes while the bug exists; when someone fixes the bug it
  fails, reminding them to turn it into a normal `test`.
- Test behaviour, not implementation details, and avoid snapshot tests of MUI output.
