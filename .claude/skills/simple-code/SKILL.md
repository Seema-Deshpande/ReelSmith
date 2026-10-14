---
name: simple-code
description: Write or change code in the ReelSmith project so a junior developer can read, review and maintain it. Use whenever you create, edit or refactor code, tests or scripts here, and when asked to "make it simple", "easy to understand" or "easy to maintain".
---

# Simple, maintainable code

The test for every file: **could a junior developer who has never seen this project read it top to bottom, understand it, and change it safely?** If not, simplify it before moving on.

Simple does not mean short. A longer file with clear steps beats a shorter file with clever tricks.

## Rules

### 1. Names say what a thing is
- Write full words: `videoPath`, `numerator`, `durationS`. Not `fp`, `tmp`, `fn`, `res2`, `d`.
- Name a variable for the thing it holds (`videoStream`, not `video` when there is also a video file).
- Functions start with a verb: `probeVideo`, `checkPlan`, `markFailed`.
- Keep one spelling for one idea across the project (`...S` means seconds: `startS`, `targetDurationS`).
- Names that come from outside (ffprobe fields like `codec_type`, database columns like `start_s`) stay as they are. Do not rename them.

### 2. Plain code, no tricks
- Use normal `function` / `async function` declarations with the steps written out. Do not squeeze logic into one-line arrow functions or long chains.
- No clever generics, loops over "parts", or helpers that take a config object to do five things. Two small functions beat one flexible one (`validateBody` and `validateParams`, not `validate({ body, params })`).
- No `this`, no deeply nested callbacks. Use `async` / `await`.
- Do not add code nobody uses yet. Add it when it is needed.
- Put numbers that mean something in a named constant or a clearly named field, with the unit (`PHRASE_PAUSE_S`, `30_000 // give up after 30 seconds`).

### 3. Small functions, one job each
- A function does one thing and is short enough to read without scrolling.
- If a function has several stages, number the steps in comments (`// 1. Ask ffprobe`, `// 2. Find the streams`) or split each stage into its own function (see `pipeline.service.ts`: one function per step).
- Split data reshaping from logic (see `helpers/jobResponse.ts`).

### 4. Files read top to bottom
Order inside a file: a short header comment, then the **main exported function first**, then helpers below it, then data shapes (types) at the bottom. A reader should meet the important part first.

The header comment says in plain words what the file does and gives a small example of its result.

### 5. Comments explain, in plain words
- Say **what the code is for** and **why** it is done this way. Do not repeat the code (`// add one to i`).
- Explain anything a junior might not know (`// promisify lets us use this with await`).
- Keep them short. One line above a function is usually enough.
- Error messages are written for a human: `"The file could not be read as a video."`, not `"ERR_PROBE_FAIL"`.

### 6. Keep the project layers
Requests flow **route → middleware → controller → service → queries → database**. Each layer only talks to the one below it.

| Folder | Holds | Never holds |
|---|---|---|
| `routes/` | URL → controller wiring | logic |
| `middleware/` | validation, upload, error handling | business rules |
| `controllers/` | read request, call service, send response | SQL, business rules |
| `services/` | the rules and the steps of a job | `req` / `res`, SQL |
| `queries/` | SQL only | rules, HTTP |
| `helpers/` | small reusable functions | anything tied to one layer |
| `config/` | settings, presets, database pool | functions that do work |
| `types/` | TypeScript types | code |
| `schemas/` | zod request checks | code that does work |

Adding an endpoint: schema, query, service function, controller function, one route line.

### 7. Handle failure on purpose
- Check input at the edge (schemas / middleware). Throw `HttpError` for client mistakes.
- A background step that fails marks the job `failed` with a human-readable reason.
- Group saves that must succeed together in `withTransaction`.
- Clean up after a failure (do not leave half-saved files or rows).

## Before you say it is done

1. Re-read the file as a junior would. Anything you had to think twice about gets simpler or gets a comment.
2. `npm run typecheck` passes.
3. `npm test` passes (API tests, separate `reelsmith_test` database).
4. If you changed the schema, add a new numbered migration in `db/migrations/` and run `npm run db:migrate`. Never edit an applied migration.
5. Add or update a Playwright test in `tests/api/` for new behaviour. Write tests as plain steps with clear names.
6. Remove any test jobs, uploads or scratch files you created.
7. Update the README if you changed the layout, the API or the settings.
8. Report plainly: what changed, what you tested, and what is not done or not checked.

## Before and after

Too clever:
```ts
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => { server.close(() => { closeDb().finally(() => process.exit(0)); }); });
}
```

Simple:
```ts
// Ctrl+C or a stop from the host: stop taking requests, close the database, then exit.
function shutdown() {
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

Too compact:
```ts
export const removeJobFiles = (jobId: string) => fs.rm(jobDir(jobId), { recursive: true, force: true });
```

Simple:
```ts
// Delete a job's whole folder.
export async function removeJobFiles(jobId: string) {
  await fs.rm(jobDir(jobId), { recursive: true, force: true });
}
```
