# Vocab Mountain — Frontend Build Plan

Handover doc. Backend is done and committed; this covers the UI only.
Read `AGENTS.md` first — this is Next.js 16.3.3 and `node_modules/next/dist/docs/`
is authoritative over training data.

Companion specs live outside the repo: `~/Downloads/prd.md`, `~/Downloads/design-spec.md`.

---

## 0. Locked decisions (do not re-litigate)

| Decision | Value |
|---|---|
| Grading | **Two-way only**: `AGAIN` \| `KNEW`. No "Almost". |
| Second axis | `revealed: boolean` — did the user flip the card before grading. |
| Gestures | left = Didn't know, right = Knew it, **up = Skip**, down = nothing. |
| "Skip" | UI name for the backend's *bury* (`buriedUntil = now + 1d`). Ungraded. This is also Sharvarii's "swipe to next word". |
| Swipe feel | Tinder-style: card follows the finger, rotates, flies out. |
| Progress scope | Per-word and **global**. Never deck-scoped. Decks only filter the queue. |
| Viewport | iPhone-first. Must stay correct at every width. |
| Comments | One-liners, only where genuinely needed. Rationale goes in chat, not files. |
| Animation | `motion` (Framer Motion v12+, package renamed). Use it for the swipe too. |
| URL state | `nuqs` for every search param. No hand-rolled `useSearchParams` + `router.replace`. |
| Sound | Short, subtle, opt-out. |
| Style | Standard Next.js App Router + shadcn conventions. Senior-dev plain. Do not over-engineer. |

---

## 1. What already exists

### Backend — complete, typechecking, committed (`83d9e1d`)

| Route | Method | Notes |
|---|---|---|
| `/api/queue` | GET | `?order=smart\|inorder\|shuffle&limit=N&ahead=true`. Returns `{order, ahead, queue:[{word, card, stage, deckPosition, groupPosition}], remaining}` |
| `/api/grades` | POST | Two body shapes — batch grades, or `{wordId, bury:true}` |
| `/api/words` | GET | search + filters incl. `wrong` (`lapses > 0`) |
| `/api/words/[id]` | GET | single word + card + confusables |
| `/api/stats` | GET | 4 figures, 28-day bars, streak |
| `/api/settings` | GET/PATCH | |
| `/api/decks` | GET | decks + word counts |

**`POST /api/grades` batch body** (this is the important one):

```ts
{
  grades: [{
    id: string,        // CLIENT-MINTED cuid — this is what makes the flush idempotent
    wordId: string,
    grade: "AGAIN" | "KNEW",
    revealed: boolean,
    ms: number,        // 0..600000, time on card
    hook?: string,     // max 2000; empty/absent never wipes an existing hook
    gradedAt?: string  // ISO. Send it — offline grades must schedule from when they happened
  }]  // 1..200
}
// -> { applied, duplicates }
```

Replaying a batch is a **no-op**, not a double-advance. Retry freely on network failure.

**`POST /api/grades` bury body**: `{ wordId, bury: true }` → `{ buried: wordId }`.

### Library code

- `lib/scheduler.ts` — `schedule(card, grade, revealed, now)`. SM-2-ish. Verified: new+KNEW cold → 2d; new+KNEW revealed → 1d; AGAIN → 1d, ease −0.2 floored at 1.3.
- `lib/stage.ts` — `stageOf(card)` / `stageWhere(stage)`, kept in lockstep. `LAPSE_THRESHOLD=6`, `SOLID_DAYS=21`. Stages: New / Shaky / Solid / Keeps slipping. **Derived, never stored.**
- `lib/session.ts` — `currentUserId()`, `unauthorized()`, `settingsFor(userId)`.
- `lib/prisma.ts`, `lib/auth.ts`, `lib/auth-client.ts` — better-auth + Google.

### Data

**Only 14 words are seeded.** Enrichment is paused at 14/1075 on a Gemini free-tier
quota wall. It is fully resumable from `prisma/seed/.cache/`. Build the UI against
14 words; do not block on this. Full corpus: 1075 words / 36 groups
(`prisma/seed/list.json`).

### Existing UI (thin)

```
app/layout.tsx          bare — no theme script, no fonts wired
app/page.tsx            landing
app/home/page.tsx       stub
components/auth/        GoogleSignInButton, SignOutButton  -> @/components/pouf/Button
components/navigation/  AppBottomNav                       -> @/src/components/pouf/*
components/pouf/        Button, pouf.css, tone.ts
src/components/pouf/    BottomNav, Button, Icon, NavLink, layout, text, pouf.css, tone
components/ui/button.tsx  shadcn leftover
```

---

## 2. Phase 1 — Foundation ✅ DONE

Nothing else is worth building until these are true. Small phase, no product surface.

**Status:** 1.1 ✅ · 1.2 ✅ (was already done) · 1.3 ✅ (was already done) · 1.4 ✅ ·
1.5 ✅ · 1.6 ✅

**Theme:** light only, by user decision. `<html data-theme="light">` is pinned in
`app/layout.tsx`; there is no theme script and no dark toggle. pouf.css keys dark
off `[data-theme='dark']`, so restoring dark later means re-adding the no-flash
script described in 1.4 — nothing else.

Corrections found while executing:

- **1.2 / 1.3 were already true.** `app/globals.css` was already the 2-line file
  (fontsource + pouf.css), there was no `@theme inline` block, no shadcn token sets,
  and no `components/ui/`. Nothing to remove.
- **The `text-muted` bug does not exist.** `--color-muted: #71609b` is *pouf's own*
  token (pouf.css line 22), not a shadcn leak. It is the intended muted purple-grey.
- **The font was already wired.** pouf.css's `@layer base` sets
  `body { font-family: var(--font) }` → `--font-pouf` → `'Nunito Variable'`, which
  `globals.css` already imports from `@fontsource-variable/nunito`. 1.4 only needed
  the theme script.
- **`UserSettings` has `speech`, not `sound`.** The §2.6 field is genuinely new.
  Added ahead of Phase 2 (schema + `DEFAULTS` + PATCH validator + migration).
- **Migration history could not replay on a fresh DB.** `corpus_and_progress` sorted
  *before* `add_better_auth` but has FKs to `user`, so every `migrate dev` failed on
  the shadow database. Squashed all three into a single `0_init` baseline, verified
  against the live DB (`migrate diff --from-config-datasource --to-schema` → no
  difference), and reconciled `_prisma_migrations`. `migrate dev` works again.

### 1.1 Collapse the duplicate 1st-Pouf install

Two copies exist. `components/pouf/` has 3 files, `src/components/pouf/` has 8.
The two `pouf.css` files are byte-identical today but will drift.

- Move `BottomNav.tsx`, `Icon.tsx`, `NavLink.tsx`, `layout.tsx`, `text.tsx` into `components/pouf/`.
- `rm -rf src/` (it is git-tracked; 8 files).
- Repoint `components/navigation/AppBottomNav.tsx` to `@/components/pouf/*`.
- Confirm `components.json` `aliases.components` is `@/components` — it is.

### 1.2 Fix the CSS entry

`app/globals.css` currently imports Tailwind twice: its own line 1, plus
`components/pouf/pouf.css` line 11. Design spec §1.1 is explicit —
*"`pouf.css` **is** the Tailwind entry. Do not add a second Tailwind import."*

Delete line 1 of `globals.css`.

### 1.3 Resolve the shadcn ↔ pouf token collision (real bug)

`globals.css` has an `@theme inline` block that runs **after** pouf's `@theme`,
so shadcn wins every name they share. Concretely `--color-muted` resolves to
shadcn's `--muted`, which `:root` sets to `#71609b` — a purple. So `text-muted`
renders purple instead of pouf's grey. Same class of problem for
`--radius-*` and `--font-sans`.

The project uses pouf for everything (design spec §5 maps every element to a pouf
component). So: strip the shadcn layer.

- Remove `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, the whole
  `@theme inline` block, the `:root` / `.dark` shadcn token sets, and the
  `@layer base` block from `globals.css`.
- Delete `components/ui/button.tsx`.
- Keep `@import "@fontsource-variable/nunito"` and `@import "../components/pouf/pouf.css"`.
- `globals.css` should end up ~3 lines.

Do not remove the `shadcn` npm dep — it's the CLI used to add registry components.

### 1.4 No-flash theme script

`app/layout.tsx` has no `data-theme`. Design spec §1.5 / PRD §4.12 require an
inline `<head>` script that sets it before first paint, or dark mode flashes white
on every load. pouf.css keys off `[data-theme='dark']` **and** `.dark`; use
`data-theme`.

Read localStorage → fall back to `prefers-color-scheme`. Must be a raw
`<script dangerouslySetInnerHTML>` in `<head>`, not an effect.

Also wire the Nunito variable font to `--font-pouf` here.

### 1.5 Add the two runtime deps

```
pnpm add motion nuqs
```

- **`motion`** — Framer Motion, renamed package as of v12. Import from `motion/react`.
- **`nuqs`** — typed URL search-param state. Wrap the app in `<NuqsAdapter>` from
  `nuqs/adapters/next/app` in `app/layout.tsx`.
- Sound needs no dep — plain `new Audio()` is enough (see §2.7).

### 1.6 Install the rest of the registry ✅ DONE

`base.json` is **only the stylesheet** — it installs no components. The components
are separate registry items, and they are grouped, not one-per-name:

```
npx shadcn@latest add --yes \
  https://1st-pouf.worksonmy.dev/r/{surface,readout,feedback,input,controls,\
segmented,toggle,charts,toast,toaster,progress,status}.json
```

| item | gives you |
|---|---|
| `surface` | `Card`, `RowCard` |
| `readout` | `Stat`, `Metric` |
| `media` (pulled in by `feedback`) | `Blob`, `Badge`, `Dot`, `Figure` |
| `feedback` | `Empty`, `Skeleton`, `ErrorNote` |
| `input` | `Field`, `Input`, `Textarea`, `inputClasses` |
| `controls` | `Switch`, `Select`, `Dialog`, `Confirm`, `Combobox`, `Tooltip` |
| `charts` | `BarChart`, `AreaChart`, `LineChart`, `PieChart` |
| `toast` / `toaster` | `Toast`, `ToastViewport`, `Toaster`, `toast()` |
| `segmented` / `toggle` / `progress` / `status` | as named |

`Shell` was already present in `layout.tsx`.

**Two registry files ship broken and were repaired locally.** `controls.tsx` and
`progress.tsx` import Radix but call Base UI's `render={<El />}` prop; Radix uses
`asChild`. `progress.tsx` additionally imported `framer-motion`, which is not a
dependency of this project (we use `motion`). Fixed: 9 `render` → `asChild`
conversions, and the import repointed to `motion/react`. This breaks the
"`components/pouf/` is read-only" rule in §5 out of necessity — **re-running the
registry install will overwrite these fixes.** Re-apply them if you do.

Components needed across the app:
`Card`, `RowCard`, `Badge`, `Dot`, `Stat`, `Segmented`, `ToggleGroup`, `Input`,
`Textarea`, `Field`, `Switch`, `Shell`, `Empty`, `BarChart`, `Blob`, `Toasts`.

Verify against `components/pouf/pouf.css` — it already defines `.pouf-rowcard`,
`.pouf-empty`, `.pouf-toast*`, `.pouf-chart`, `.pouf-progress`, `.pouf-tabs`,
`.pouf-skeleton*` etc., and tokens `--color-{bg,surface,ink,muted,purple,blue,mint,pink,orange,yellow}`,
`--radius-{blob,card,control,pill}`, tones `.tone-{up,down,idle,warn,info,...}`.

**Exit criteria:** `pnpm build` clean, one `pouf/` directory, no shadcn tokens,
dark mode does not flash, `text-muted` is grey.

---

## 3. Phase 2 — The study loop ✅ BUILT (untested against a real session)

**Files:** `app/study/page.tsx` (server shell: auth gate + settings) ·
`components/study/StudySession.tsx` (queue, prefetch, keyboard, caught-up) ·
`components/study/SwipeCard.tsx` (gesture + both faces) ·
`components/study/types.ts` · `lib/grade-queue.ts` · `lib/sfx.ts` ·
`scripts/make-sfx.ts` → `public/sfx/*.wav`.

Reachable from `/home` via a "Start studying" link (a placeholder until the
Phase 3 bottom nav lands — `AppBottomNav` still points at `/practice`, `/add`
and `/settings`, none of which exist).

**Deviations from the spec below, all deliberate:**

- **No `dragSnapToOrigin`.** Its spring-back fires on `onDragEnd`, the same
  handler that starts the commit fly-out, and the two fight. Spring-back is
  animated by hand in the no-commit branch instead, so the paths stay disjoint.
- **The flick threshold also requires `|offset.x| > 40`.** `|velocity.x| > 500`
  alone will commit a grade on a 5px jitter. A misgrade is expensive here.
- **Confusables are not on the card.** `/api/queue` doesn't return them — only
  `/api/words/[id]` does — and fetching per card would violate §2.5. Add
  `confusableWith` to the queue payload to finish §2.7.
- **Per-card state resets during render, not in an effect.** React's
  `set-state-in-effect` rule rejects the effect form, and an effect would paint
  one frame of the new word showing the previous card's back.
- **Prefetch appends instead of paging.** `/api/queue` has no cursor, so a
  refetch overlaps what we already hold; the client flushes first, then filters
  by `wordId` against a session-scoped `handled` set.
- **The screen is a `100svh` column with a pinned footer**, not `Shell` — `Shell`
  is a 260px-sidebar app shell and put the grade buttons below the fold. The
  card region flexes; the back face scrolls inside the card via
  `touch-action: pan-y`, which hands the browser the vertical gesture and leaves
  motion the horizontal one. **Cost: up-to-skip does not fire inside the
  scrolling back face** — the Skip button and `↑`/`S` still do. Skip works
  everywhere on the unrevealed front.
- **The root is plain text, not a `Badge`.** `Badge` is `whitespace-nowrap
  flex-none`; a root gloss like "ob- against, in the way of + via way" is a
  phrase and overflowed the card. Synonym/antonym labels also moved above their
  chips — inlining a label into a wrapping row reflows the chips into a
  staircase.

**Not yet verified:** nobody has run a signed-in session. The gesture, the
fly-out, sound on iOS, and offline replay are all unexercised.



This is the product. Design spec §3: *"the core interaction. Everything else in
the app is in service of it."* Build only this in Phase 2.

### 2.1 Card state machine

Two-way grading means the card has exactly these states:

```
        ┌──────────────────────────────────────────┐
        v                                          │
   ┌─────────┐  tap / space   ┌──────────┐         │
   │ PROMPT  │ ─────────────> │ REVEALED │         │
   │ (front) │                │  (back)  │         │
   └─────────┘                └──────────┘         │
        │                          │               │
        │  swipe L/R               │  swipe L/R    │
        v                          v               │
   ┌───────────────────────────────────────┐       │
   │ COMMITTED  grade + revealed flag       │       │
   │ 190ms fly-out, THEN enqueue grade      │──────┘ next card
   └───────────────────────────────────────┘
        ^
        │  swipe UP (from either state)
   ┌─────────┐
   │ SKIPPED │  POST {wordId, bury:true}, no grade, no review row
   └─────────┘
```

`revealed` is the second axis and it is what the scheduler uses to dampen the
interval (KNEW-after-reveal advances less than KNEW-cold). **Track it honestly** —
set it the instant the back is shown, never reset it on the same card.

Suggested shape:

```ts
type CardState = {
  phase: "prompt" | "revealed" | "leaving";
  revealed: boolean;      // sticky once true
  shownAt: number;        // for ms
  dx: number; dy: number; // live drag offset
};
```

### 2.2 Gesture handling — Framer Motion

The design spec says hand-roll Pointer Events and avoid a drag library.
**We are overriding that**: use `motion`'s `drag`. It gives correct velocity,
spring-back, and pointer capture for less code than the manual version, and it is
the conventional choice. Keep the spec's *numbers* — only the mechanism changes.

```tsx
const x = useMotionValue(0);
const y = useMotionValue(0);
const rotate  = useTransform(x, (v) => v / 24);
const knewOp  = useTransform(x, [20, 130], [0, 1], { clamp: true });
const againOp = useTransform(x, [-20, -130], [0, 1], { clamp: true });
const skipOp  = useTransform(y, [-20, -110], [0, 1], { clamp: true });
```

```tsx
<motion.div
  drag
  dragElastic={0.6}
  dragSnapToOrigin            // spring-back is free when we don't commit
  style={{ x, y, rotate, touchAction: "none" }}
  onDragEnd={(_, info) => { /* thresholds below */ }}
  onTap={reveal}              // motion disambiguates tap vs drag for us
/>
```

Thresholds in `onDragEnd`, using `info.offset` and `info.velocity`:

- Commit L/R: `|offset.x| >= 130` **or** `|velocity.x| > 500` (flick).
- Skip: `offset.y <= -110` and `|offset.y| > |offset.x|`. Check this **first**.
- Otherwise let `dragSnapToOrigin` return it.
- On commit: `animate()` the card off-screen over **190ms**, then enqueue and advance.
  Await the animation before advancing so the next card doesn't pop in early.
- `onTap` handles reveal — don't add a separate click handler, motion already
  suppresses tap after a drag.
- Wrap the card in `<AnimatePresence mode="popLayout">` so the next card rises in.
- Respect `prefers-reduced-motion` via `useReducedMotion()` — skip the fly-out,
  keep the state change. Drag still works.

### 2.3 Buttons — every gesture needs one (spec §8)

Row under the card: `[ Didn't know ]  [ Knew it ]`, plus a small `Skip` affordance.
Keyboard: `←` AGAIN, `→` KNEW, `↑`/`S` skip, `space` reveal.

### 2.4 The grade queue — build this as a standalone module ✅ WRITTEN

`lib/grade-queue.ts` (client). This is what makes a swipe feel instant.
Written ahead of the rest of Phase 2 because it has no dependency on the registry.
Exports `enqueueGrade`, `flush`, `startGradeQueue`, `pendingCount`, `bury`.
`pagehide` / `visibilitychange` use `sendBeacon` and deliberately leave entries
queued — the client-minted ids make the next mount's replay a server-side no-op.
**Not yet exercised by a UI.**

- A swipe **never** awaits the network. Push to an in-memory array, advance the UI.
- Mint `id` client-side (`crypto.randomUUID()` is fine — schema takes any string).
- Stamp `gradedAt` at swipe time.
- Flush on: 10 pending, 5s idle, `visibilitychange` → hidden, `pagehide`, or
  Caught-up screen.
- Mirror pending grades to `localStorage` before flushing; clear on 2xx. Replay on
  next mount — idempotent ids make this safe.
- On failure, keep them queued and retry with backoff. Never drop.

Skip/bury is a separate immediate POST (it's not batched — different body shape).

### 2.5 Prefetch

`GET /api/queue` returns the whole batch up front. Hold it in state, render from
memory. Fetch the next page when `< 5` cards remain. No per-card network call.

### 2.6 Sound

Keep it tiny. A `lib/sfx.ts` module with preloaded `Audio` instances and one
`play(name)` function is the whole implementation — no library, no context, no
provider.

- Four cues only: `knew`, `again`, `skip`, `caught-up`. Short (<300ms), quiet
  (`volume ≈ 0.3`), non-musical.
- Fire on **commit**, not on drag start.
- `audio.currentTime = 0; audio.play().catch(() => {})` — autoplay rejection on
  iOS before first interaction must not throw.
- iOS Safari needs a user gesture before any audio plays; the first swipe *is* one,
  so preload on mount and let the first `play()` fail silently.
- Gate on a `sound` setting, default on. ✅ **schema field done** —
  `sound Boolean @default(true)` on `UserSettings`, migration applied, plus the
  field in `lib/session.ts` `DEFAULTS` and the settings PATCH validator.
  (Note: the pre-existing `speech` field is a *different* setting; both now exist.)
- Also mute when `prefers-reduced-motion` is set.

✅ Done. `scripts/make-sfx.ts` (run with `pnpm sfx`) synthesises the four cues
into `public/sfx/` — sine partials with a fast exponential decay and a one-pole
lowpass, 90–290ms, normalised to 0.55 peak with `lib/sfx.ts` playing at 0.3.
Real audio, not silence. Regenerate freely; tweak the `CUES` table to retune.

### 2.7 Screens

- **`/` or `/study`** — the card. Front: term + pronunciation (+ blank sentence if
  `sentenceFirst`). Back: meaning, example, root (if `showRoots`), synonyms,
  antonyms, confusables, hook editor.
- **Caught up** — flush the queue, show today's count, offer *Study ahead*
  (`?ahead=true`).

**Exit criteria:** a full session can be completed by gesture alone on an iPhone;
killing the tab mid-session loses nothing; replaying a flush changes no state.

---

## 4. Phase 3 — Everything around the loop

- **`/browse`** — search + filters via `/api/words`. Must include the **"all wrongs"**
  filter (`?filter=wrong`, `lapses > 0`) — an explicit request from Sharvarii.
  `RowCard` per word, stage `Dot`, infinite scroll or paging.
  **All of this state lives in the URL via `nuqs`** — `useQueryStates` with
  `parseAsString` for `q`, `parseAsStringLiteral([...])` for `filter`/`stage`,
  `parseAsInteger` for the page. Set `throttleMs: 300` on the search input and
  `shallow: false` only if a server component needs to re-render. A filtered
  browse view must be shareable and survive a refresh.
- **`/words/[id]`** — full detail, confusables, personal hook, review history.
- **`/stats`** — 4 `Stat` figures, 28-day `BarChart`, streak. Global, not per-deck.
- **`/settings`** — `dailyGoal`, `studyOrder`, `sentenceFirst`, `showRoots`,
  `keyboardHints`, `speech`, `activeDeckId`. PATCH on change, optimistic.
- **`/decks`** — deck picker feeding `activeDeckId`.
- **Bottom nav** — Study / Browse / Stats / Settings. `BottomNav` + `NavLink` exist.
- **Auth gating** — every API route 401s without a session; redirect to sign-in.
- **PWA** — manifest + `apple-mobile-web-app-capable`, `viewport-fit=cover`,
  `env(safe-area-inset-bottom)` on the nav.

---

- **`/study` params** — `order` and `ahead` also belong in the URL via `nuqs`, so a
  study-ahead session is linkable.

---

## 5. House rules

Standard Next.js App Router conventions, and the shadcn *pattern* — components are
vendored into the repo via the CLI and owned by us. (We drop shadcn's theme layer
in §1.3, but keep the registry workflow; 1st-Pouf ships as a shadcn registry.)
Concretely:

- **Server Components by default.** `"use client"` only on the leaf that needs
  state or a gesture. The study card is client; its page shell is not.
- **Data fetching**: server components read via Prisma directly where it's a plain
  page render; the client uses `fetch` against the API routes for anything
  interactive. Don't add React Query/SWR for this — the queue is prefetched once
  and held in state.
- **Mutations**: the grade queue posts to `/api/grades` because it needs batching
  and offline replay. Everything else (settings, deck switch) can be a Server
  Action — but the existing PATCH routes are fine too. Pick one per surface and
  be consistent; don't build both.
- **`components/` layout**: `components/pouf/` is vendored registry code — treat it
  as read-only. App components go in `components/<feature>/`.
- **No abstraction until the third use.** No generic `<Swipeable>`, no config
  objects, no event bus, no state-machine library. There is one card and one
  gesture.
- Run `npx next typegen` after adding routes; `params` is a `Promise` in this
  Next version.

---

## 6. Open questions for the user

1. **Stage gap.** PRD defines Shaky as `< 7d` and Solid as `≥ 21d`, leaving 7–21d
   unlabeled. Currently Shaky covers everything under 21d, so an 18-day card reads
   "Shaky". One-line change in `lib/stage.ts` — leave it, lower Solid to 7d, or add
   a fourth label.
2. **Curated decks.** PRD names three (1,200 high-frequency / 500 essential /
   re-taker's 100). Only `gregmat-all` + 36 group decks exist. The subsets need a
   membership rule before they can be built.
3. **Enrichment.** Paused at 14/1075. Options: enable Google Cloud billing
   (~$2, ~15 min), trickle on the free tier using the resumable cache, or point
   `scripts/lib/model.ts` at Claude instead.

---

## 7. Commands

```
pnpm dev
pnpm build
npx next typegen            # after adding routes; needed for RouteContext<...>
pnpm corpus:enrich          # resumable; reads/writes prisma/seed/.cache/
pnpm corpus:collect         # .cache/ -> prisma/seed/words.json
pnpm corpus:validate        # hard-fails on PRD acceptance criteria
pnpm db:seed                # idempotent upsert on term
```
