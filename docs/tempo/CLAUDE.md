# Operating rules for TEMPO

You are implementing the game described in `DESIGN.md`, one ticket at a time from
`TASKS.md`, against the frozen interfaces in `CONTRACTS.md`.

Read `CONTRACTS.md` before writing any code. It is the source of truth for every
signature, constant, and data shape. `DESIGN.md` explains *why*; `CONTRACTS.md` says
*what*; `TASKS.md` says *what next*.

## The loop

1. Open `TASKS.md`, take the **first ticket that is not `[x]`**. Do not skip ahead, and
   do not batch several tickets into one change.
2. Implement exactly what the ticket's **Implement** section lists — only the files in
   its **Files** list.
3. Run the ticket's **Accept** command. It must pass.
4. Run `npm test` (the full suite). It must pass — not just your new test.
5. Tick the ticket `[x]` in `TASKS.md` and commit.
6. Stop and report. One ticket per session.

## Hard rules

- **Never change a signature, constant, or data shape in `CONTRACTS.md`.** If a ticket
  seems to require it, stop and say so. A contract change is a human decision, because
  every other ticket was written against it.
- **No runtime dependencies.** The game ships as vanilla JS + Canvas2D with no
  framework, no bundler, no build step. `playwright` is the only permitted dev
  dependency. Do not add others; do not reach for one to solve a problem.
- **No DOM outside the allowed files.** `src/core/**` and `src/game/**` must never
  touch `window`, `document`, `navigator`, or `canvas`. The only exceptions are
  `src/core/input.js`, `src/core/audio.js`, and everything under `src/render/` and
  `src/ui/`. This is enforced by a test — it is what keeps the simulation unit-testable
  in Node.
- **No `Math.random()` in `src/`.** All randomness goes through the seeded RNG, or runs
  stop being reproducible and every sim test becomes flaky. Also enforced by a test.
- **Do not modify files outside your ticket's Files list.** No opportunistic
  refactoring, renaming, or "while I was here" cleanup. If you spot a real problem
  elsewhere, note it in your report and leave it alone.
- **No `TODO`, no stubs, no placeholder returns.** A ticket is finished or it is not.
  If you cannot finish it, revert your partial work, and report what blocked you.
- **Never commit failing or skipped tests.** Do not mark a test `.skip` to get green.
  If a test fails and you believe the test is wrong, stop and report — do not edit the
  test to match your code.

## Style

Match the surrounding code. Plain functions and plain objects; no classes, no
inheritance, no event emitters, no dependency injection frameworks. Factory functions
returning object literals, exactly as `CONTRACTS.md` shows. Comment *why*, not *what* —
the code already says what.

Keep allocations out of the per-frame path. Anything created every frame must come from
a pool. This is a real constraint, not a preference: GC pauses show up directly as
dropped dodges.

## Commands

| Command | Does |
|---|---|
| `npm test` | Full Node unit suite + the architecture guard tests |
| `npm run smoke` | Playwright: boots the page, runs the sim, asserts no errors and fps floor |
| `npm run serve` | Static server on :8000 for manual play |
| `npm run assets` | Fetches and verifies assets (exists from ticket F1 onward) |

Chromium is preinstalled at `/opt/pw-browsers`. **Never run `playwright install`** — it
will try to download a browser and fail. `PLAYWRIGHT_BROWSERS_PATH` is already set.

## Network

Most of the web is blocked by the sandbox proxy. Reachable: `git clone` of public
GitHub repos, `raw.githubusercontent.com`, `registry.npmjs.org`, and Google Fonts.
Blocked: `kenney.nl`, `opengameart.org`, `freesound.org`, Wikimedia, and
`codeload.github.com`. The GitHub API is scoped to this repo only, so there is no
repo or code search. See `DESIGN.md` §5.1. Do not spend time rediscovering this.

## Git

Work on `claude/fun-game-planning-q3tlny`. Push with
`git push -u origin claude/fun-game-planning-q3tlny`. One commit per ticket, subject
line `<ticket id>: <what changed>`, e.g. `A2: add seeded mulberry32 RNG`. Do not open a
pull request unless asked.
