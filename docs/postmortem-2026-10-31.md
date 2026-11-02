# Postmortem: AI organizing broken by a stray line in production

**Date:** October 31, 2026
**Duration:** about 15 minutes (1:34 AM to 1:49 AM ET)
**Impact:** Every attempt to organize a note failed. No notes were lost.

## Summary

While adding an access code to protect the API, the code value itself (`ATX26`) was pasted into `api/organize.js` as a bare line, instead of only being stored as an environment variable in Vercel. JavaScript treated `ATX26` as an undefined variable, so the serverless function crashed on every request. The fix removed the line and added the intended access-code check.

## Timeline (ET)

| Time | Event |
| --- | --- |
| 1:34 AM | Commit `c509884` ("Add access code") pushed. Vercel deploys it automatically. |
| 1:35 AM | Reviewing the commit on GitHub shows the server-side check is missing and line 11 reads `ATX26`. |
| 1:36 AM | Confirmed the cause: `ATX26` is a `ReferenceError` at runtime, so every request to `/api/organize` fails. |
| 1:36 to 1:48 AM | Several fix attempts. One edit was saved but not committed, and one changed the wrong line, so the fix took longer to land. |
| 1:49 AM | Commit `18a44ee` ("Fix access code check") pushed. The correct check replaces the stray line. |
| 1:50 AM | Verified on GitHub. The access-code logic was tested with missing, wrong, and correct codes. |

## What went well

- **No notes were lost.** The app saves each note on the phone before calling the AI, so failed requests were kept as "Unsorted" and could be organized later.
- **The secret stayed secret.** The real code lives in a Vercel environment variable. The stray line was an accident, not where the code was meant to be stored.
- **Fast detection.** The problem was found within about a minute by reviewing the change on GitHub.

## What went wrong

- **No automated tests or CI.** Nothing ran the code before it went live, and a syntax check alone would not have caught it, since `ATX26` is valid syntax that only fails when the function runs.
- **Every push deploys straight to production.** There was no preview step between a change and real users.
- **Editing under pressure.** Late-night fixes led to an unsaved file and an edit on the wrong line, which slowed the recovery.

## What changed

| Action | Status |
| --- | --- |
| Added 21 automated tests for the server functions, the stats page, and the web page | Done |
| Tests check that no access code or API key appears anywhere in the code | Done |
| GitHub Actions runs every test on every push and pull request | Done |
| Confirmed the tests catch this exact bug: putting the `ATX26` line back makes 11 tests fail | Done |
| Ship future features on branches with Vercel preview links before merging | Planned |

## Lesson

Secrets belong in environment variables, and every change should run through automated tests before users see it.
