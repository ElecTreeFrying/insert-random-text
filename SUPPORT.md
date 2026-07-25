# Support & Contributing — Random, Fake & Mock Data Generator

Where to get help, how to diagnose common issues, and how to contribute. For features and configuration see the [README][README]; for the exact command, setting, and data-catalog contract see [SPEC.md][SPEC].

[README]: https://github.com/ElecTreeFrying/insert-random-text/blob/main/README.md
[SPEC]: https://github.com/ElecTreeFrying/insert-random-text/blob/main/SPEC.md

---

## Table of Contents

- [Quick Links](#quick-links)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Troubleshooting](#troubleshooting)
- [Reporting a bug](#reporting-a-bug)
- [Feature requests](#feature-requests)
- [Contributing](#contributing)
  - [Setup](#setup)
  - [Adding a generator](#adding-a-generator)
  - [Adding a parameterized (prompted) command](#adding-a-parameterized-prompted-command)
  - [Tests](#tests)
- [Support the project](#support-the-project)

---

## Quick Links

| Resource                           | What you'll find                                                    |
|------------------------------------|---------------------------------------------------------------------|
| [README][README]                   | Feature overview, the type catalog, commands, full settings table    |
| [SPEC.md][SPEC]                    | Every command, setting, and catalog row with its exact contract      |
| [CHANGELOG][CHANGELOG]             | Release notes and version history                                    |
| [GitHub Issues][issues]            | Bug reports, feature requests, questions                             |
| [VS Code Marketplace][marketplace] | Install page, reviews, version listings                              |

[CHANGELOG]: https://github.com/ElecTreeFrying/insert-random-text/blob/main/CHANGELOG.md
[issues]: https://github.com/ElecTreeFrying/insert-random-text/issues
[marketplace]: https://marketplace.visualstudio.com/items?itemName=ElecTreeFrying.insert-random-text

---

## Frequently Asked Questions

### Does this extension send my data anywhere?

**No.** It is 100% local — no telemetry, no network calls, no AI model calls. The [Faker][faker] library is **bundled into the extension**, so nothing is fetched at runtime and no value you generate (or anonymize) ever leaves your machine. You can read every line of the [source on GitHub][source].

[faker]: https://fakerjs.dev
[source]: https://github.com/ElecTreeFrying/insert-random-text/tree/main/src

### Is it compatible with Cursor / VSCodium / Code Server?

**Yes.** The extension uses only the public VS Code API. It runs in any host that implements the API at engine `^1.97.0` or later — including Cursor, VSCodium, Code Server, and other forks.

### Does it work in the browser (vscode.dev / github.dev)?

**Yes.** A dedicated browser build ships alongside the desktop one (`browser` → `dist/web/extension.js`), with faker inlined into both. The web bundle is built for the browser target specifically so it can't depend on Node built-ins — if one ever crept in, the build would fail rather than ship a broken web extension.

### How do I get the same values on every run?

Set `insertRandomText.seed` (or run **Insert Random: Set Seed**) to any number. Every run then replays the identical sequence — single inserts, records, and whole datasets alike. Leave it blank for random output.

Reproducibility is **per locale**: the same seed under `en` and under `ja` gives different values, but each is stable across runs.

### How do I fill a whole column at once?

Stack cursors (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>Option</kbd>/<kbd>Alt</kbd>+<kbd>↓</kbd>, or <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>D</kbd> to add selections), then run any Insert Random command. Each cursor draws its own value — that's `insertRandomText.uniquePerCursor`, on by default. Raise `insertRandomText.bulkCount` to insert several values *per* cursor in one step.

### Why only six locales — faker ships dozens?

Every shipped locale is bundled into the `.vsix` (roughly 60 KB each), and pulling in faker's full locale set would multiply the package size for data most users never draw. Six (`en`, `de`, `fr`, `es`, `pt_BR`, `ja`) cover the common cases at a package size that installs instantly. If you need another one, [open an issue][issues] — adding a locale is a small, well-scoped change.

### Why isn't there a setting for single vs. double quotes?

Because the file already answers the question. When `withQuote` is on, the quote style is resolved from the **language of the file you're inserting into**: SQL-family languages get single quotes with `''`-doubling for embedded apostrophes (`O'Brien` → `'O''Brien'`), and everything else gets double quotes. That way the same command lands valid syntax in `.json`, `.go`, `.py`, and `.sql` without you switching a setting per file. See [SPEC — §Quote Wrapping & Language-Aware Quoting][SPEC-quotes].

Records are the deliberate exception — they escape by **shape** (JSON / SQL / CSV), not by the file's language, because a JSON record has to stay valid JSON wherever you drop it.

[SPEC-quotes]: https://github.com/ElecTreeFrying/insert-random-text/blob/main/SPEC.md#quote-wrapping--language-aware-quoting

### What's the difference between Record… and Generate Dataset…?

**Record…** composes your picked fields into one record and inserts it **at your cursors**, honoring your insert type, quoting, and bulk count. **Generate Dataset…** builds up to **100,000 rows** and opens them as a **new untitled file** — CSV gains a header row, JSON is always an array, SQL is one `INSERT` per line. Because a dataset is a whole document, the insert type never applies and no editor needs to be open. See [README — §Generate whole datasets][readme-datasets].

[readme-datasets]: https://github.com/ElecTreeFrying/insert-random-text/blob/main/README.md#generate-whole-datasets

### Can I add my own data?

**Yes** — two settings, both surfaced at the top of **Insert Random: Pick…**:

- `insertRandomText.templates` — name → a faker template string (`"INV-{{string.numeric(4)}}"`), re-rendered fresh at every cursor and bulk item.
- `insertRandomText.customLists` — name → an array of strings, drawn from at random.

**Custom lists also appear as Record… fields** (the name becomes the field key); templates do not. Both survive **Reset Settings to Defaults** — they're your data, not tuning. See [README — §Your own data][readme-own-data].

[readme-own-data]: https://github.com/ElecTreeFrying/insert-random-text/blob/main/README.md#your-own-data

### Why are there no default keyboard shortcuts?

With 130+ types — and 170+ contributed commands all told — any preset binding would collide with something you already use. Bind the few types you reach for instead: **Keyboard Shortcuts** (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>S</kbd>) → search **Insert Random** → click the ✎ pencil. Binding **Insert Random: Pick…** to one shortcut gives keyboard-fast access to every type through its searchable menu.

### Do my old keybindings still work?

**Yes.** The original 14 `extension.insert*` command ids (`insertRandom*` and `insertLorem*`) are kept permanently for back-compat, so existing keybindings and `tasks.json` references keep working untouched. Every generator is also reachable under the namespaced `insertRandomText.<id>` form, and that is the family the Command Palette lists — the legacy ids are contributed but hidden from the palette, so nothing appears twice. Where a legacy id kept its original wording, the palette title and the Pick… label can differ — *Insert Random: Person* in the palette, **Full Name** in Pick… — but they're the same generator.

### Is Randomize Selection a real anonymizer?

Treat it as **shape-preserving obfuscation for fixtures, logs, and bug reports** — not as a security guarantee. It re-rolls letters and digits in kind (and swaps a detected email / UUID / ISO date for a fresh realistic one of the same type), which is exactly right for sharing a screenshot or a test file. But it preserves length and layout, it doesn't touch structure or surrounding context, and a **seeded** run is reproducible by anyone who knows the seed. For regulated or genuinely sensitive data, use a purpose-built redaction tool.

### Why can't I find "Lorem Small" or "Hash Medium" in Pick…?

Those are back-compat generators kept alive for their original commands (*Insert Random: Lorem Small*, *Insert Random: Hash Medium*, …). They're marked hidden so they still answer their legacy command ids without cluttering the Quick Pick with four near-identical lorem entries. Run them by name from the Command Palette, or use **Words (Count…)** / **Paragraphs (Count…)** for an exact size.

---

## Troubleshooting

Each section below is **symptom → cause → fix**. If your issue isn't here, [open an issue][issues].

### A command runs but nothing is inserted

**Causes:**

- Your `insertType` is **Clipboard** — the value was copied, not inserted. The confirmation is a brief status-bar message (`Copied random … to clipboard`), which is easy to miss.
- There is **no active text editor** — with `insertType` at `Cursor` or `Top`, the command needs a focused editor and returns silently without one (focus is in the Explorer, a terminal, or a settings tab).

**Fix:** Run **Insert Random: Set Insert Type** and pick `Cursor`, and click into the editor before running the command. (**Generate Dataset…** and Clipboard mode are the two paths that need no editor at all.)

---

### Every cursor gets the *same* value

**Cause:** `insertRandomText.uniquePerCursor` is off, which repeats one drawn value across all cursors by design.

**Fix:** Run **Insert Random: Toggle Unique Value Per Cursor** (or set it to `true` in Settings). It's on by default.

---

### Values repeat inside one insert even with Strict Unique on

**Cause:** Strict Unique re-draws duplicates against a seen-set with a bounded retry budget — it never loops forever. When the type's pool is smaller than the number of values you asked for (booleans, weekdays, months, a two-item custom list), duplicates are unavoidable and the last draw is kept rather than hanging the editor.

**Fix:** None needed for small pools — it's working as intended. For genuinely unique output, pick a high-cardinality type (UUID, ULID, Nano ID, Email) or lower `bulkCount` / the cursor count.

---

### I get the same values every single run

**Cause:** `insertRandomText.seed` is set. That's the feature — a seed makes output reproducible.

**Fix:** Run **Insert Random: Set Seed** and submit an **empty** value to return to random output.

---

### Locale is set, but values still come out English

**Causes:**

- The type has **no localized data** — UUIDs, numbers, hashes, hex colors, IP addresses, semver strings and similar are language-neutral and fall back to English by design. Names, addresses, words, and companies are the ones that visibly change.
- The locale value is invalid. `insertRandomText.locale` accepts exactly `en`, `de`, `fr`, `es`, `pt_BR`, `ja` (spelled as faker spells them — note the underscore and capital in `pt_BR`); anything else falls back to `en`.

**Fix:** Set the locale with **Insert Random: Set Locale** so the value is guaranteed valid, and test with a name or street address. No reload is needed — the next insert picks it up.

---

### Quotes are the wrong style, or missing entirely

**Causes:**

- `withQuote` is off — nothing is wrapped.
- The file's language isn't what you think. Quote style is resolved from the editor's **language id**, so an untitled or `plaintext` buffer gets the default double quotes even if you're writing SQL in it.

**Fix:** Toggle quoting with **Insert Random: Toggle Wrap With Quotes**. For the SQL style (single quotes + `''`-doubling), save the file with a `.sql` extension or set the language mode explicitly (click the language indicator at the bottom-right of the status bar).

---

### My template or custom list doesn't appear in Pick…

**Cause:** The entry failed shape validation and was dropped. Both settings are strictly typed — `templates` must be *name → string*, and `customLists` must be *name → array of strings*. A nested object, a number in a list, or an empty array is discarded rather than crashing the picker, and each drop is logged.

**Fix:** Check the exact shape:

```jsonc
"insertRandomText.templates": {
  "invoice": "INV-{{string.numeric(4)}}"
},
"insertRandomText.customLists": {
  "environment": [ "dev", "staging", "production" ]
}
```

**Insert Random: Manage Templates** / **Manage Custom Lists** jump straight to these settings. To see the drop warnings, open **Help → Toggle Developer Tools → Console** and reload the window.

---

### My saved templates aren't offered as Record… fields

**Cause:** Intentional. **Custom lists** are field-shaped — one name, one value — so they join the Record… field picker and the name becomes the field key. **Templates** are free-form renderings, not fields, so they're offered in **Pick…** but not in the record composer.

**Fix:** Use a custom list when you need the value as a record field; use **From Template…** or **Pick…** for template output.

---

### `"…" failed to render: … — fix it via Insert Random: Manage Templates.`

**Cause:** A saved template references a faker path that doesn't exist (a typo, or a method that isn't available), so the render threw at insert time.

**Fix:** The message names the failing template and the command that opens it. Prototype the string in **Insert Random: From Template…** first — that input box validates as you type by test-rendering, and shows faker's error plus a working example — then paste the working version into the setting.

---

### `insertRandomText.dateFormat` doesn't change Weekday or Month

**Cause:** Weekday and Month generate **names** (`Tuesday`, `March`), not timestamps. The date format applies only to the timestamp types — Date, Past/Future/Recent/Soon Date, Birthdate, and **Date (Between…)**.

**Fix:** None needed; this is by design.

---

### Timestamps look shifted from my local time

**Cause:** Rendered date and time components are derived in **UTC**, not your local timezone, so `isoTime` on a machine in UTC+8 won't match your wall clock. `unixSeconds` additionally floors to whole seconds.

**Fix:** Expected behavior — UTC keeps output stable across machines and CI, which matters for seeded fixtures. Use `iso` if you want the trailing `Z` to make the timezone explicit.

---

### Bulk count won't accept a value above 1000

**Cause:** `insertRandomText.bulkCount` is capped at 1000 values per cursor — the input box rejects more.

**Fix:** For larger volumes use **Insert Random: Generate Dataset…**, which is built for bulk (up to 100,000 rows into a new file) instead of stuffing them into one line of an open document.

---

### Generate Dataset… asks me to confirm, or refuses my row count

**Cause:** Large datasets take a moment to build and open, so a row count above 10,000 shows a modal confirmation, and the hard ceiling is 100,000 rows.

**Fix:** Confirm the modal to proceed, or split a larger export into several files. If your workflow genuinely needs more rows in one pass, [open an issue][issues] and say how many.

---

### A setting change doesn't apply in another window or folder

**Cause:** Settings commands write to the **open workspace** when a folder is open, and to your **global user settings** only when none is. So a value set while a project was open lives in that project's `.vscode/settings.json`.

**Fix:** To change a default everywhere, run the command from a window with **no folder open**, or edit the User settings scope directly (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>,</kbd> → the **User** tab).

---

### Reset Settings didn't clear my templates or custom lists

**Cause:** Deliberate. The reset restores tuning settings — insert type, quoting, bulk count, formats, seed, locale — but skips `templates` and `customLists`, because those are content you authored, not configuration. The confirmation modal says so before it runs.

**Fix:** Clear them yourself via **Manage Templates** / **Manage Custom Lists** if you really want them gone.

---

### `Select some text first — Randomize Selection replaces each selection in place.`

**Cause:** Randomize Selection replaces **selections**, so bare cursors with nothing selected give it nothing to work on. If every selection is empty, you get this message and nothing changes.

**Fix:** Select the text to scrub (multi-select works — every non-empty selection is replaced in one step).

---

### Randomize Selection scrambled my email instead of drawing a fresh one

**Cause:** Type detection is deliberately strict — the selection must be **exactly** the value, with nothing around it. A trailing space, surrounding quotes, a `key: ` prefix, or a partially-selected value all fail the check and fall through to the safe same-shape scramble. Timestamps must be UTC (`Z`-suffixed) and dates must be real calendar dates to be detected. Numbers are intentionally never "typed" — the scramble already produces a valid number of the same shape.

**Fix:** Select the value alone, without quotes or padding, and rerun. The fallback scramble is never wrong — just less realistic.

---

### There's no Insert Random submenu in the right-click menu

**Cause:** The editor context-menu submenu is **off** by default, to keep the right-click menu uncluttered for people who work from the Command Palette.

**Fix:** Run **Insert Random: Toggle Editor Context Menu** (or set `insertRandomText.contextMenu.enabled` to `true`).

---

## Reporting a bug

[Open an issue][issues] and include:

1. **Extension version** (visible in the Extensions panel — click the gear icon → *About*).
2. **VS Code version** (`Help → About` or <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → *About*), and the host if it isn't VS Code itself (Cursor, VSCodium, vscode.dev, …).
3. **OS and version** (e.g. macOS 14.5, Windows 11, Ubuntu 24.04).
4. **The command you ran** — the exact palette title (e.g. *Insert Random: UUID (Format…)*).
5. **Relevant settings** — at minimum `insertType`, `withQuote`, `insertRandomText.bulkCount`, `outputFormat`, `locale`, and `seed` if set. A **seed makes the bug reproducible**, so include it whenever you can.
6. **The file's language mode** (bottom-right of the status bar) — quoting depends on it.
7. **Expected vs. actual** output — paste the generated text, or "nothing inserted".
8. **Screenshot or screen recording** if the problem is visual (multi-cursor issues especially).

A seeded reproducer plus the file's language mode is usually enough to pin a bug in one pass.

---

## Feature requests

Open an issue labelled **enhancement** on [GitHub Issues][issues]. Helpful to include:

- The workflow it would improve (the *why*, not just the *what*).
- **For a new data type:** an example of the output you'd want, and the [faker][faker] module/method it maps to if you know it.
- **For a new locale:** which one, and whether faker ships it.
- **For a new record/dataset shape:** a sample of the exact text you'd want generated.

Note that a type is only worth adding if faker can produce it coherently — the extension is a curated surface over faker, not a rules engine, so requests that need bespoke generation logic are a bigger lift than they look.

---

## Contributing

### Setup

```bash
git clone https://github.com/ElecTreeFrying/insert-random-text.git
cd insert-random-text
npm install
```

Press <kbd>F5</kbd> inside VS Code (**"Run Extension"**) to launch an Extension Development Host with the extension loaded. The default build task builds first and rebuilds on every save.

```bash
npm run compile      # check-types + lint + esbuild → dist/ (node + web bundles)
npm run watch        # incremental dev build (esbuild + tsc --noEmit in parallel)
npm run check-types  # tsc --noEmit
npm run lint         # eslint src
npm run package      # production build; what vscode:prepublish runs
```

The architecture worth knowing before you start: **generation is `vscode`-free**. The registry (`src/catalog.ts`), the formatter, the quote policy, records, the randomizer, and the prompted-command definitions are all pure modules that never import `vscode` — `src/extension.ts` is thin editor glue over them. Keep that split; it's what makes the logic testable headlessly.

See [SPEC.md][SPEC] for the full user-facing contract and [README — §Commands][readme-commands] for the command table.

[readme-commands]: https://github.com/ElecTreeFrying/insert-random-text/blob/main/README.md#commands

### Adding a generator

The common case — a new type that draws a value with no parameters. **Five sites**, and they must stay in sync:

1. **`src/catalog.ts`** — add a `{ id, label, group, generate }` entry. It appears in **Pick…** and the Record… field picker automatically.
2. **`package.json` → `contributes.commands`** — add `{ "command": "insertRandomText.<id>", "title": "Insert Random: <Label>" }`. This is what makes the type directly runnable *and* searchable in the palette.
3. **`src/extension.ts`** — add `'insertRandomText.<id>': '<id>'` to `COMMAND_TO_GENERATOR`.
4. **`README.md` → the *What it generates* table** — add the type to its category row and bump that category's `(N)`. The headline total is deliberately soft ("130+"), so it never needs a per-type edit.
5. **`SPEC.md` → the *Data Catalog*** — add the row under its category heading (label / registry id / command id / faker source) and bump that heading's `(N)` **plus every literal total** in the file. SPEC.md has no soft numbers — grep the old totals before you finish. The totals are gated: `src/test/config/spec-totals.test.ts` pins every command literal in SPEC.md to `package.json` and `COMMAND_TO_GENERATOR`, so a missed total fails the suite instead of shipping.

Two rules that are easy to trip over:

- **Draw a fresh value per call.** `generate()` is invoked once per cursor; a cached or memoized value silently repeats itself down the column.
- **Never import the faker root.** Only the shipped `@faker-js/faker/locale/<id>` entries are imported, each as a *literal* dynamic import, so esbuild can inline them. Importing the root pulls in 60+ locales and blows the package size budget.

`activationEvents` are generated from `contributes.commands`, so there's nothing to register there.

### Adding a parameterized (prompted) command

For a type that asks the user for input first (a range, a length, a format):

1. **`src/prompted.ts`** — add an entry to `promptedCommands` with its `steps` (input boxes and/or Quick Picks) and exactly **one** rendering surface: `render(params)` for a stateless draw, or `createRender(params)` for a stateful one (Sequence's counter is the only current example). A spec test enforces the exactly-one rule.
2. **`package.json`** — add the `insertRandomText.<id>` command.

Registration is automatic. Prompted commands are intentionally **not** in `COMMAND_TO_GENERATOR` and **not** catalog entries — they never appear in **Pick…** or **Record…**, because they can't produce a value without asking first. A parity test holds contributed ↔ registered commands in sync and guards prompted ids against catalog-id collisions, so a half-finished addition fails the suite rather than shipping.

### Tests

Tests live in `src/test/<area>/*.test.ts` (mocha `describe` / `it`) and are compiled to `out/` — never `dist/`, which is the production esbuild bundle.

```bash
npm test              # full Extension Host suite (pretest compiles tests + the extension, and lints)
npm run test:coverage # same chain + coverage report
```

The pure areas also run **headless**, which is much faster while iterating:

```bash
npm run compile-tests
npx mocha "out/test/{quote,config,catalog,engine,format,record,prompted,custom,randomize}/*.test.js"
```

- Don't widen that glob to `**` — `extension.test.ts` and `commands/` import `vscode` and can't run under plain node. Those need `npm test`.
- `out/` keeps orphaned compiled tests after a `.test.ts` is deleted or renamed. If headless results look stale, `rm -rf out` and recompile.
- Use Node's built-in `assert`; write in BDD style.

Before opening a PR, the release gate is: `npm run check-types` + `npm run lint` + a production build + `npx @vscode/vsce package` (keep the `.vsix` at roughly 1.5 MB or under).

---

## Support the project

If this extension saves you time, consider:

- **Starring** the repo on [GitHub](https://github.com/ElecTreeFrying/insert-random-text)
- **Leaving a review** on the [VS Code Marketplace][marketplace]
- **Donating** — addresses are listed in the [README's Support section][donate]

[donate]: https://github.com/ElecTreeFrying/insert-random-text/blob/main/README.md#support
