# Project instructions

## Commit timestamps

- Apply this policy whenever creating, amending, rebasing, or pushing commits in this repository.
- Both Git author and committer timestamps must be outside 09:00 (inclusive) to 17:00 (exclusive) EST every day. EST means fixed UTC−05:00 year-round, including during daylight saving time.
- Choose timestamps that look natural across the commit sequence. Retain the original spacing where practical; avoid giving every commit the same time, clustering them at a fixed boundary, or applying a mandatory fixed shift.
- Keep timestamps in chronological order: each adjusted commit's author and committer dates must be later than the corresponding dates of its parents, including parents that are already published. Keep the committer date at or after the author date. Consider the surrounding history when choosing dates.
- Future timestamps are allowed, including dates after 17:00 EST on the current day or on a later day. Use them when needed to satisfy the allowed hours and chronological order; do not wait to push solely because a commit is future-dated.
- A request to commit and push authorizes correcting timestamps on this task's unpushed commits before pushing; do not ask for this permission again.
- Before pushing, inspect both dates on every outgoing commit, converting the actual instants to UTC−05:00 instead of relying on the stored offset. Verify allowed hours and chronological order across the sequence and its parent boundary. Adjust this task's unpushed commits as a group when needed; keep existing dates where they satisfy all guardrails. Recheck after the final rewrite, since rebase and amend operations can reset committer dates.
- Explicitly control both author and committer dates when creating or rewriting commits. Capture original dates before rewriting to retain useful spacing. `git commit --date` alone does not set the committer timestamp; set `GIT_COMMITTER_DATE` as well.
- Timestamp-only amendments must preserve file contents, staged changes, commit messages, author identities, commit order, and merge structure. Do not accidentally include staged changes in an amendment.
- Do not rewrite published commits or other contributors' commits, or force-push, solely to enforce this policy. If any such outgoing commit violates the policy, explain the conflict before pushing.
- Report timestamp adjustments when completing a commit/push request. This policy changes Git metadata; it does not change the actual time work or a push occurs.

## Testing signed in

- Whenever you open the app in a browser (the built-in browser pane or Chrome), add `?devMute` to the first URL (e.g. `http://localhost:5173/dashboard?devSignIn&devMute`). App audio is disturbing for the user to hear while you test. It mutes every sound in that browser until `?devMute=off`, while playback still runs, so audio features stay testable (`src/lib/devMute.ts`, dev server only).
- To check a signed-in flow in the app, run `npm start` and open the local URL with `?devSignIn` (e.g. `http://localhost:5173/dashboard?devSignIn`). The app signs in as the shared test user `dev-test-user` ("Dev Tester"), with no password or Google account involved.
- The token comes from a dev-server-only endpoint (`scripts/lib/devSignInPlugin.ts`) that answers only local requests and needs `service-account.json` in the project root. It is not part of production builds or the phone preview.
- The test user reads and writes the production Firebase project, but only its own data under `users/dev-test-user`. Create, edit and delete custom items freely there, and clean up anything that would confuse later tests.
- The test user is deliberately not an admin. Never give it an admin claim, and don't use it for admin-only flows (built-in content edits, audio regeneration); those change shared production data.
- Signing in this way replaces any other account in that browser and clears its offline data, as a normal sign-out does.
