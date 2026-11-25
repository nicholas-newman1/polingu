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
