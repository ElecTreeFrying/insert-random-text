# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VS Code extension (display name **"Random, Fake & Mock Data Generator"**, id `insert-random-text`, publisher `ElecTreeFrying`) that inserts random / fake / mock data — names, emails, addresses, numbers, dates, UUIDs, lorem ipsum, and ~130 types in all — at **every cursor**. Randomness comes from **`@faker-js/faker`** (single-locale `en`).

### Project goals (north star)
1. Grow active installs in the random/mock-data category (near-term: pass the category mid-tier; long-term: challenge the leader). Active installs *subtract* on uninstall, so **retention is the real metric** — every defect fix is rank-defending.
2. Value is the engine: each generator is simultaneously a real feature, a searchable command title, and a Quick Pick entry. Breadth = discoverability + utility.

## Commands

- `npm run compile` — type-check + lint + **esbuild** bundle (`src/extension.ts` → `dist/extension.js`)
- `npm run watch` — incremental dev build; `watch:esbuild` + `watch:tsc` in parallel (`npm-run-all`). Default build task (auto-runs on F5 via `preLaunchTask`).
- `npm run check-types` — `tsc --noEmit` (esbuild does the actual transpile)
- `npm run lint` — `eslint src` (flat config, `eslint.config.mjs`)
- `npm run package` — production build: `check-types && lint && esbuild --production`. `vscode:prepublish` runs this.
- `npx @vscode/vsce package` — build the `.vsix` (runs prepublish first). Keep the packaged `.vsix` ≤ ~1.5 MB.

`main` is `./dist/extension.js` (esbuild bundle, **faker inlined**). `dist/` and `out/` are gitignored — build before running. **esbuild's entry is `src/extension.ts`, so that file must keep its name/location** (the entry is configured in `esbuild.js`, which is out of the usual edit scope).

### Verification
Tests live in **`src/test/<area>/*.test.ts`** (mocha `describe`/`it`; `compile-tests` transpiles them to `out/`). Two tiers:
- **Pure areas, headless** — `npm run compile-tests && npx mocha "out/test/{quote,config,catalog,engine,format,record}/*.test.js"`. Don't widen the glob to `**`: `extension.test.ts` and `commands/` import `vscode` and fail under plain node.
- **Full suite (Extension Host)** — `npm test` (`pretest` runs compile-tests + compile + lint first). Required for `commands/` and `extension.test.ts`.

Gotcha: `out/` keeps orphaned compiled tests after a `.test.ts` is deleted/renamed — `rm -rf out` before a headless run when results look stale. Release gate on top of tests: `check-types` + `lint` + `node esbuild.js --production` + `npx @vscode/vsce package`.

### Running / debugging
Press F5 → **"Run Extension"** opens an Extension Development Host with the extension loaded (the `preLaunchTask` builds first).

## Architecture

Eight single-responsibility modules. Generation is `vscode`-free and lives apart from the editor glue, so the logic that matters is decoupled from the API surface:

- **`src/engine.ts`** — faker lifecycle: `load()` (lazy, idempotent), the `faker()` accessor, and `seed()`. Encapsulates the ESM/dynamic-import detail (see Gotchas). No `vscode` import.
- **`src/catalog.ts`** — the **generator registry**: the `Generator` interface and the readonly `generators` array (each `{ id, label, group, hidden?, generate() }`), plus `getGenerator(id)`. Single source of truth — drives generation, the commands, and the Quick Pick. No `vscode` import.
- **`src/formatter.ts`** — **pure** rendering: `buildBlocks(cursorCount, generator, options)` returns one block per cursor; `formatBlock` applies `bulkCount` + `outputFormat` (`plain` / `jsonArray` / `quotedList`) + quote/newline wrapping (escaping per the quote policy). No `vscode` import → trivially checkable.
- **`src/quotePolicy.ts`** — **pure** language-aware quoting: `resolveQuotePolicy(languageId, opts)` maps a file's `languageId` to a `{ quote, escape }` policy (SQL-family → single quotes + `''`-doubling; everything else → double quotes); `formatter.wrap()` consumes the `escape`. No `vscode` import.
- **`src/record.ts`** — **pure** multi-field records: `buildRecords(fields, shape, opts)` composes picked generators into one JSON object / SQL `INSERT` row / CSV line (stacked by `bulkCount`); escaping is decided by the **shape**, not the file's language. No `vscode` import.
- **`src/configuration.ts`** — `Configuration` reads workspace settings into a typed `Settings` via `read()`; `ConfigKey` holds the package.json key constants; the two enum settings are normalized to booleans here. Depends only on a narrow `WorkspaceLike` seam, not `vscode`.
- **`src/extension.ts`** — thin activation entry. `COMMAND_TO_GENERATOR` maps every command id → a generator id; `activate()` registers them all through one `insertGenerated(id)`, plus the `insertRandomText.pick` Quick Pick and the `insertRandomText.record` multi-field composer (both honor `insertType`). `insertGenerated`: `load()` faker → `applySeed()` → read cached `settings` → `buildBlocks` over `editor.selections` (Cursor mode = multi-cursor fill; Top mode = one block at line 1; Clipboard mode = a bare value copied to the clipboard, no editor needed).
- **`src/settingsCommands.ts`** — palette commands that *write* settings: `SETTING_COMMANDS` maps command id → handler (Quick Pick for the enum settings, toggle for the booleans, input box for bulk count / seed, plus a confirm-gated reset). Writes to the open workspace when one is present, else global user settings; `extension.ts` registers them. The read side stays in `configuration.ts`.

### Config flow (the key cross-file mechanism)
`extension.ts` holds a single module-level `settings: Settings`. On activate, `watchConfiguration()` snapshots it via `Configuration.read()`, then re-snapshots on any relevant `onDidChangeConfiguration`. Commands read this **cached** `settings`, never re-reading at invocation. Anything bypassing `watchConfiguration` sees stale config.

### Commands & settings model
- **Two command namespaces.** The original 14 `extension.insertRandom*` ids are kept for **back-compat** (existing keybindings); every new type uses a namespaced `insertRandomText.<id>` id. Both register via `COMMAND_TO_GENERATOR`.
- **Settings are split.** The 3 remaining legacy keys stay **flat & non-namespaced** (`insertType`, `withQuote`, `withNewLine`) for back-compat; **all new keys are namespaced** under `insertRandomText.*` (`uniquePerCursor`, `seed`, `bulkCount`, `outputFormat`, `contextMenu.enabled`). Do **not** migrate the legacy keys.
- **Hidden generators.** The Lorem/Hash Small/Medium/Large back-compat generators carry `hidden: true` so they serve their legacy commands without cluttering the Quick Pick.
- **Settings commands.** `settingsCommands.ts` contributes `insertRandomText.set*` / `toggle*` / `resetSettings` so every setting is changeable from the Command Palette (mirrors the sibling `auto-import-relative-path`). Each new one is a `package.json` command + an entry in `SETTING_COMMANDS` (registered in `extension.ts`). Writes are workspace-scoped when a folder is open, else global.

### Adding a generator (the common case)
1. `src/catalog.ts` — add a `{ id, label, group, generate }` entry. It appears in the Quick Pick automatically.
2. `package.json` → `contributes.commands` — add `{ "command": "insertRandomText.<id>", "title": "Insert Random: <Label>" }` (direct command + search visibility).
3. `src/extension.ts` — add `'insertRandomText.<id>': '<id>'` to `COMMAND_TO_GENERATOR`.
4. `README.md` → the **What it generates** table — add the type to its category row and bump that category's `(N)` count (and the "19 categories" figure if it's a new group). The headline total is deliberately soft ("130+"), so it never needs a per-type edit.

(activationEvents are auto-generated from `contributes.commands` since VS Code 1.74 — nothing to update there.)

### Config value conventions
- `insertType`: a 3-value enum — `Cursor` (multi-cursor fill at each selection) / `Top` (one block at line 1 / `0,0`) / `Clipboard` (copy to the clipboard, no editor) — normalized to `'cursor'` / `'top'` / `'clipboard'` in `configuration.ts`.
- Quoting: no user quote-style setting — the quote + escape are resolved automatically from the file's `languageId` (SQL → single + `''`-doubling; everything else → double), only when `withQuote` is on.

## Gotchas

- **faker is ESM-only; the bundle is CJS.** `engine.ts` loads the single-locale instance via a **dynamic `import('@faker-js/faker/locale/en')`** inside `load()` — a *static* import trips `TS1479` under `module: Node16`. The faker **type** is imported with `import type { Faker } from '@faker-js/faker' with { 'resolution-mode': 'import' }` (the `TS1542` fix). esbuild inlines the dynamic import into the single CJS bundle. **Always import `/locale/en` — never the faker root** (60+ locales → multi-MB bundle, blows the `.vsix` size gate).
- **Fresh value per call — never a cached getter.** `Generator.generate()` is called once per cursor inside the `editor.selections` loop and must draw a new value each time. (The old code had an "animal double-draw" bug from a getter read twice — the registry shape structurally prevents it; don't reintroduce stored/memoized generator values.) With `seed` set, the sequence is reproducible.
- **Line endings are LF**, enforced by `.gitattributes` (`* text=auto eol=lf`).

## Scope & toolchain
- **Core work lives in `src/**`, `package.json`, `README.md`, `CLAUDE.md`, `CHANGELOG.md`.** Out of scope (later waves): icon assets under `images/`, CI, Open VSX, `tsconfig.json` / `esbuild.js`.
- TypeScript 5.9 (target `ES2022`, module `Node16`, `strict: false`), ESLint 9 flat config (rules are warnings), esbuild bundling, engine `vscode ^1.97.0`. **Runtime dependency: `@faker-js/faker`** (bundled into `dist/`). Mirrors the sibling `auto-import-relative-path` extension.
