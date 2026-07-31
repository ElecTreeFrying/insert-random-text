# Contributing

Thanks for wanting to help. Bug reports, feature requests, and pull requests are all
welcome — **new data generators especially.** Breadth is the whole value of this
extension, and a new generator is one of the easiest first contributions here.

## Before you start

- **Open an issue first** for anything structural. A new generator usually does not
  need one; a new *setting* or a change to how insertion works does.
- Read [`SPEC.md`](../SPEC.md). It is the user-facing contract — every command, every
  setting, every catalog row. If your change alters behavior, **it lands there too**.

## Setup

```bash
npm install
```

Press <kbd>F5</kbd> → **Run Extension** to launch an Extension Development Host.

## The commands that matter

```bash
npm run compile        # check-types + lint + esbuild (node AND web)  ← "green"
npm run watch          # incremental dev build
npm run lint           # eslint src
npm run package        # production build; what vscode:prepublish runs

# Headless — the vscode-free areas, no Extension Host needed
npm run compile-tests && npx mocha "out/test/{quote,config,catalog,engine,format,record,prompted,custom,randomize}/*.test.js"

# Full suite — required for commands/ and extension.test.ts
npm test
```

Do not widen that mocha glob to `**`: `extension.test.ts` and `commands/` import
`vscode` and fail under plain node. And if headless results look stale after renaming
or deleting a test, `rm -rf out` — orphaned compiled tests linger there.

## Adding a generator — the common case

1. **`src/catalog.ts`** — add a `{ id, label, group, generate }` entry. It shows up in
   the Quick Pick automatically.
2. **`package.json`** → `contributes.commands` — add
   `{ "command": "insertRandomText.<id>", "title": "Insert Random: <Label>" }`.
3. **`src/extension.ts`** — add `'insertRandomText.<id>': '<id>'` to
   `COMMAND_TO_GENERATOR`.
4. **`README.md`** → the *What it generates* table — add the type to its category row
   and bump that category's `(N)`. The headline total is deliberately soft ("130+"),
   so it never needs touching.
5. **`SPEC.md`** → the *Data Catalog* — add the row under its category heading and
   bump that heading's `(N)`, **plus every literal total in the file**. SPEC.md has no
   soft numbers; grep the old totals and update all of them.

`activationEvents` are generated from `contributes.commands` automatically — nothing
to update there.

## Two rules that are easy to break

**Never delete a legacy command id.** The original `extension.insert*` ids stay
registered permanently. VS Code has no command-alias mechanism, so removing one
silently breaks any keybinding a user already made. They are hidden from the palette
via `contributes.menus.commandPalette` with `when: "false"` — that is why they do not
appear twice.

**Draw a fresh value per call.** `Generator.generate()` runs once per cursor inside
the selections loop and must return a new value each time. Do not store or memoize a
generated value — an earlier bug came from exactly that, and the registry shape now
prevents it structurally.

## Before you open a PR

1. `npm run compile` passes — including the **web** bundle. esbuild hard-fails the
   `dist/web` build on any Node built-in, which is what keeps the extension usable on
   vscode.dev. If you reach for a Node API, that gate will stop you, and it is right to.
2. Tests pass.
3. `SPEC.md` and the README table reflect the change.
4. The packaged `.vsix` stays under ~1.5 MB. **Only import the shipped
   `@faker-js/faker/locale/<id>` entries — never the faker root**, which pulls 60+
   locales and blows the size gate.
5. Your commits do not bump `version` in `package.json` — releases own that.

## Code style

- **LF line endings**, enforced by `.gitattributes`.
- **Padded single-line arrays**: `[ 'a', 'b' ]`, not `['a', 'b']`.
- Generation code stays free of `vscode` imports. That separation is what makes the
  logic testable without an Extension Host, and it is worth protecting.

[`CLAUDE.md`](../CLAUDE.md) has the fuller architecture notes. It is written for
maintainers, but it is the honest map of this codebase.

## Reporting bugs

Use the issue templates. [`SUPPORT.md`](../SUPPORT.md) may resolve the problem before
you file.

For **security** problems, do not open an issue — see [`SECURITY.md`](SECURITY.md).
