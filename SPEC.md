# Random, Fake & Mock Data Generator — Functionality Specification

A VS Code extension (id `insert-random-text`, publisher `ElecTreeFrying`) that inserts random, fake & mock data — names, emails, addresses, finance, git, UUIDs, lorem ipsum, mock JSON, and ~130 types in all — at **every cursor**, at the **top of the file**, or onto the **clipboard**. A [Record command](#multi-field-records) composes several types into one structured record — a JSON object, SQL row, or CSV line. Every value is generated locally by [`@faker-js/faker`](https://fakerjs.dev) (single-locale `en`); there are no network calls and no telemetry.

**137 generator types across 20 categories** (plus 6 hidden back-compat variants — 143 registry entries in all), **161 contributed commands**, **no default keybindings**, **eleven configuration settings**, and **one editor context-menu submenu**.

The generation logic is `vscode`-free and decoupled from the editor glue: a generator produces a value, a formatter renders a block, a quote policy decides the wrapping, and a thin activation layer maps commands and cursors onto that pipeline. Each stage is documented below.

---

## Commands

The extension contributes **161 commands**, in five families:

| Family | Count | Id shape | Purpose |
|---|---|---|---|
| Generator commands | 143 | `extension.insertRandom*` (legacy, 14) · `insertRandomText.<id>` (modern, 129) | Insert one data type. Each maps to exactly one registry entry (see [Data Catalog](#data-catalog)). |
| Quick Pick | 1 | `insertRandomText.pick` | "Insert Random: Pick…" — a searchable menu over the whole catalog. |
| Record | 1 | `insertRandomText.record` | "Insert Random: Record…" — compose several types into one structured record (see [Multi-Field Records](#multi-field-records)). |
| Prompted commands | 4 | `insertRandomText.numberRange` / `floatRange` / `stringLength` / `dateBetween` | Ask for parameters in input boxes, then insert through the normal pipeline (see [Parameterized commands](#parameterized-commands-prompted)). |
| Settings commands | 12 | `insertRandomText.set*` / `toggle*` / `resetSettings` | Change any setting from the Command Palette (see [Settings Commands](#settings-commands)). |

Every command title is prefixed **`Insert Random:`**, so typing "Insert Random" in the Command Palette (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) surfaces all of them. **No keybindings are contributed** — the extension ships zero default key bindings, so nothing conflicts with the user's existing bindings out of the box; any command can be bound manually in *Keyboard Shortcuts* (search **Insert Random**). Binding `insertRandomText.pick` gives one-shortcut access to the whole catalog.

### Two command namespaces

- **Legacy `extension.insertRandom*` (14 commands)** — the original ids, kept verbatim for **back-compat** so existing user keybindings keep working. They cover eight visible generators (`animal`, `person`, `date`, `country`, `number`, `string`, `lorem`, `hash`) and the six hidden Lorem/Hash size variants. These eight generators have **no** modern `insertRandomText.*` command — the legacy id is their only command.
- **Modern `insertRandomText.<id>` (129 commands)** — every other generator. The command suffix is byte-identical to the generator's registry `id` (e.g. `insertRandomText.creditCard` → generator `creditCard`).

Both namespaces register through a single `COMMAND_TO_GENERATOR` map (143 entries) in `extension.ts`; each registered command calls one shared `insertGenerated(id)`. See the [Data Catalog](#data-catalog) for the exact command id of every type.

### Insert Random: Pick…

`insertRandomText.pick` opens a Quick Pick listing every **visible** generator (hidden back-compat variants are excluded), grouped under category separator headings in registry order. The picker placeholder reads *"Insert Random — pick a type to insert at every cursor…"*, and `matchOnDescription` is on, so typing filters against each entry's registry id as well as its label. Selecting an entry routes through the same `insertGenerated` path as a direct command — so the active [Insert Target](#insert-targets), [output format](#output-formats), and [quote policy](#quote-wrapping--language-aware-quoting) all apply. Pressing Escape dismisses the picker with no insertion.

### Insert Random: Record…

`insertRandomText.record` opens the same catalog picker in **multi-select** mode: tick any number of fields and one composed record — a JSON object, SQL `INSERT` row, or CSV line, per the `recordFormat` setting — is inserted at every cursor. Fully specified in [Multi-Field Records](#multi-field-records).

### Parameterized commands (prompted)

Four commands ask for parameters in input boxes, then insert through the **same pipeline** as every other command — the [insert target](#insert-targets), [output format](#output-formats), [quote policy](#quote-wrapping--language-aware-quoting), [`bulkCount`, `uniquePerCursor`](#multi-cursor-fill--bulk-generation), and [`seed`](#seeding--reproducibility) all apply:

| Command | Id | Input boxes | Draw |
|---|---|---|---|
| Insert Random: Number (Range…) | `insertRandomText.numberRange` | min, then max — whole numbers, `min ≤ max` enforced at the max box | A fresh integer in `[min, max]` per value |
| Insert Random: Float (Range…) | `insertRandomText.floatRange` | min, then max — any finite numbers, `min ≤ max`; the range must contain a multiple of 0.01 | A fresh float in `[min, max]`, rendered with 2 decimals (same style as the Float type) |
| Insert Random: String (Length…) | `insertRandomText.stringLength` | length — a whole number 1–1000 | A fresh alphanumeric string of exactly that length (same charset as the String type) |
| Insert Random: Date (Between…) | `insertRandomText.dateBetween` | from, then to — `YYYY-MM-DD` or full ISO 8601, `from ≤ to` enforced at the to box; impossible calendar dates (e.g. `2026-02-31`) are rejected | A fresh instant in `[from, to]` per value, rendered per the [`dateFormat`](#configuration-reference) setting like the zero-argument Time types |

Behaviors:

- **Validation is live** (`validateInput`): invalid text shows an inline error and blocks accept — empty, non-numeric, fractional-where-integer, out-of-range, and `max < min` inputs never reach the generator; dates additionally reject non-`YYYY-MM-DD`/ISO shapes, impossible calendar dates, and `to < from`.
- **Last-used values are remembered** (`globalState`, trimmed) and prefilled on the next run; before first use the prefills reproduce the matching zero-argument type (Number: 0–1000, Float: 0–1000, String: 15) or a wide decade (Date: 2020-01-01 – 2030-12-31).
- **Esc at any box cancels cleanly** — nothing is inserted, no error, and nothing new is remembered (values accepted *before* the cancel are remembered).
- The seed is applied **after** the prompts, immediately before generation, so a pinned seed reproduces the same output regardless of typing time.
- These are **not** registry entries: they don't appear in the Pick… menu or the Record… field list. Each is a one-off generator built from the entered parameters and fed into the shared insert path (`insertWith`).

---

## Insert Targets

Where a generated value is delivered is governed by the `insertType` setting (`Cursor` / `Top` / `Clipboard`, normalized internally to `cursor` / `top` / `clipboard`). Every insert command honors it — the generator commands, the Quick Pick, and the [Record command](#multi-field-records) alike.

### Cursor (default)

Fill a fresh block at **every** selection in the active editor.

- The extension iterates `editor.selections` and, in one `editor.edit`, calls `builder.replace(selection, block)` for each — so the block **replaces** any selected text and lands at a bare caret when the selection is empty. This is the multi-cursor fill.
- After the edit, every cursor is **collapsed to sit right after its inserted block** — nothing stays selected, same as if the value had been typed. (Applies to the Record command's cursor fill too.)
- Blocks are built with `buildBlocks(selections.length, generator, options)`, honoring [`uniquePerCursor`](#multi-cursor-fill--bulk-generation): a *different* value at each cursor when on, the *same* value repeated when off.
- **Requires an active editor.** With no editor focused the command is a silent no-op.

### Top

Insert **one** block at the very start of the document.

- A single block is built with `uniquePerCursor: false` and inserted at `Position(0, 0)` (line 1, column 1); existing content is pushed down. Cursor count is irrelevant — Top always inserts exactly one block.
- Whether the block ends with a newline (pushing prior line-1 content onto its own line) depends on the [Trailing new line](#configuration-reference) setting.
- **Requires an active editor.** Silent no-op when none is focused.

### Clipboard

Copy a value to the system clipboard — **no editor needed**.

- One block is built with the quote **forced off** (`quote: ''`, a bare value) *unless* the [output format](#output-formats) is `quotedList` (whose whole point is quoting, so the resolved quote is kept), plus `newline: ''` and `uniquePerCursor: false`.
- The value is written via `vscode.env.clipboard.writeText`, then a status-bar message `$(clippy) Copied random <label> to clipboard` shows for ~2.5s.
- [`bulkCount`](#multi-cursor-fill--bulk-generation) and [output format](#output-formats) still apply: a bulk clipboard copy yields multiple values laid out per the format (e.g. a JSON array, or bare values one per line for `plain`).
- A [record](#multi-field-records) copy is the record text **verbatim** — nothing stripped or wrapped, escaping stays shape-driven — with its own `$(clippy) Copied random record to clipboard` toast.

| Target | Editor required | Cursor count used | Quote wrapping | Trailing newline | Confirmation |
|---|---|---|---|---|---|
| **Cursor** | Yes (else no-op) | All selections | Per [quote policy](#quote-wrapping--language-aware-quoting) | Per setting | Silent |
| **Top** | Yes (else no-op) | Ignored (one block at `0,0`) | Per quote policy | Per setting | Silent |
| **Clipboard** | No | Ignored (one block) | Off, except `quotedList` | Off | Status-bar toast |

---

## Multi-Cursor Fill & Bulk Generation

Two independent multipliers decide how many values a single command produces.

### Unique value per cursor

`insertRandomText.uniquePerCursor` (default **on**) controls the multi-cursor fill in `buildBlocks`:

- **On** — each cursor gets its own `formatBlock` call, so every cursor draws **fresh** values. This is the core "fill a column with a different value in each row" behavior.
- **Off** — one block is computed once and the identical string is repeated at every cursor.

Top and Clipboard targets always build with `uniquePerCursor: false` internally (they produce a single block regardless of this setting).

### Bulk count

`insertRandomText.bulkCount` (default `1`, range `1`–`1000`) is how many values are generated **at each cursor**. In `formatBlock` the count is clamped defensively — `Math.max(1, Math.floor(bulkCount || 1))` — so `0`, negatives, `NaN`, or a fractional value degrade to a sane whole number ≥ 1 rather than erroring.

### Fresh value per call

`Generator.generate()` is invoked **once per value** and must never be memoized — the registry shape (a `generate()` function, not a cached getter) structurally prevents the historical "double-draw" bug. With `C` cursors, `bulkCount = N`, and unique-per-cursor on, one command performs `C × N` independent `generate()` calls. With a [seed](#seeding--reproducibility) set, that whole sequence is reproducible.

---

## Output Formats

`insertRandomText.outputFormat` decides how the `bulkCount` values **at a single cursor** are laid out. It is orthogonal to multi-cursor fill (each cursor renders its own block in the chosen format). The trailing newline (when [enabled](#configuration-reference)) is appended after the whole block in all three formats.

| Format | Rendering | Example (`bulkCount = 2`) | Quote handling |
|---|---|---|---|
| **`plain`** (default) | One value per line — values joined by `\n`. | `alpha`<br>`bravo` | Each value wrapped per the [quote policy](#quote-wrapping--language-aware-quoting). |
| **`jsonArray`** | A JSON array via `JSON.stringify` per value: `[ … ]` with a leading/trailing space. | `[ "alpha", "bravo" ]` | **Bypasses** the quote policy — `JSON.stringify` always emits double-quoted, JSON-escaped strings. Numeric/boolean generators are still emitted as quoted strings (every `generate()` returns a string). |
| **`quotedList`** | A comma-space–separated list of wrapped values. | `"alpha", "bravo"` | Each value wrapped per the quote policy (this is the one format that keeps quotes even on a Clipboard copy). |

---

## Quote Wrapping & Language-Aware Quoting

Values are optionally wrapped in quotes so they land as valid string literals. The **generated value is universal** — only the *wrapping* is language-specific. `withQuote` and the file's `languageId` feed one resolver, `resolveQuotePolicy`, which returns a `{ quote, escape }` pair.

### Settings

| Setting | Effect |
|---|---|
| `withQuote` (default **on**) | Master switch. Off ⇒ no wrapping at all. When on, the quote + escape are resolved automatically from the file's language. |

### Resolution precedence

`resolveQuotePolicy(languageId, { withQuote })` evaluates in this order — the first match wins:

1. **`withQuote` off** → `{ quote: '', escape: 'backslash' }` — no wrapping.
2. **SQL-family language** → `{ "'", 'sqlDouble' }` — single quotes, doubling an embedded `'`.
3. **Everything else** (including `languageId` `undefined` — no active editor, e.g. a Clipboard insert with nothing focused) → `{ '"', 'backslash' }`.

### Language buckets

| Bucket | Language IDs | Resolved quote | Escape | Why |
|---|---|---|---|---|
| **SQL family** (5) | `sql`, `mysql`, `pgsql`, `plsql`, `sqlite` | `'` | sqlDouble | SQL string literals are single-quoted; an embedded `'` is escaped by **doubling** it. |
| **Everything else** | JSON, Go, Java, Rust, C/C++, C#, … and JS/TS, Python, Ruby, PHP, every unlisted language, and the no-editor case | `"` | backslash | Double quotes are a valid string literal everywhere (and the only legal quote in JSON/Go/Java/Rust/…), and stay apostrophe-clean. |

### Escape styles

`wrap(value, quote, escape)` wraps one value, escaping the quote character inside so the literal stays valid:

- **`backslash`** (default) — backslash-escape any `\`, then the quote char. `O'Brien` → `'O\'Brien'`.
- **`sqlDouble`** — double the quote char, no backslashing. `O'Brien` → `'O''Brien'`.

With no quote (`quote === ''`) the value is returned untouched. The `jsonArray` output format never calls `wrap` — it delegates escaping to `JSON.stringify`.

---

## Seeding & Reproducibility

`insertRandomText.seed` (a string; blank by default) makes output deterministic. Before **every** insert command, `applySeed()` runs:

1. Trim the setting. **Blank ⇒ return** (faker stays random).
2. Parse with `Number(raw)`. **`NaN` ⇒ skip** (a non-numeric value left in `settings.json` leaves faker random; the [Set Seed](#settings-commands) command's input box rejects non-numeric input up front).
3. Otherwise call `faker().seed(value)`.

Because the seed is re-applied at the **start of each command**, faker is reset to the same starting point every time — so two separate runs of the same command with the same seed produce **identical** output. Within a single command, the sequence advances, so multi-cursor and bulk values differ from one another while remaining reproducible run-to-run.

---

## Multi-Field Records

`insertRandomText.record` — **"Insert Random: Record…"** — composes several catalog types into **one structured record**: a JSON object, a SQL `INSERT` row, or a CSV line. It is the one insert command that renders multiple fields per value; delivery follows the [`insertType` setting](#insert-targets) like every other insert.

### Flow

1. A **multi-select** Quick Pick (`canPickMany`) lists every visible generator under the same category separators as [Pick…](#insert-random-pick) — placeholder *"Pick fields for the record…"*, `matchOnDescription` on. Tick any number of fields.
2. Field order in the record follows **catalog order**, regardless of the order the fields were ticked in.
3. The [seed](#seeding--reproducibility) is applied, then the record is delivered per the [insert target](#insert-targets): a block at **every** selection (replacing selected text) in Cursor mode, a single block at `0,0` in Top mode, or a verbatim copy in Clipboard mode.
4. An empty or cancelled pick inserts nothing. With **no active editor**, Cursor and Top are silent no-ops; Clipboard still copies (no editor needed).

### Record shapes

`insertRandomText.recordFormat` picks the shape. Escaping is decided **by the shape, not the file's language** — the [quote policy](#quote-wrapping--language-aware-quoting) is bypassed, so the record stays valid syntax for its own format wherever it lands.

| Shape | One record | `bulkCount` > 1 | Escaping |
|---|---|---|---|
| **`json`** (default) | A bare object — `{ "firstName": "Ada", "email": "a@x.dev" }` — keys are generator ids. | Records wrap into a JSON array: `[ { … }, { … } ]`. | `JSON.stringify` per key and value. |
| **`sql`** | `INSERT INTO <table> (firstName, email) VALUES ('Ada', 'a@x.dev');` — `<table>` from `insertRandomText.recordSqlTable`. | One statement per line. | Values single-quoted; an embedded `'` is doubled (`''`). |
| **`csv`** | `Ada,a@x.dev` — values only, **no header row**. | One line per record. | A value containing `,`, `"`, CR, or LF is wrapped in `"…"` with internal `"` doubled; anything else is untouched. |

### Which settings apply

| Setting | Effect on records |
|---|---|
| `insertRandomText.bulkCount` | Records per cursor, stacked per shape (same ≥ 1 clamp as [bulk generation](#multi-cursor-fill--bulk-generation)). |
| `insertRandomText.uniquePerCursor` | On — fresh records at every cursor; off — one composed block repeated at each. |
| `insertRandomText.seed` | Applied before the insert, exactly as for single-value commands. |
| `insertType` | Honored — cursors, top of file, or clipboard, exactly as for [single values](#insert-targets). Top and Clipboard build a **single** record. |
| `insertRandomText.dateFormat` | Honored — a timestamp Time field renders per the setting, same as a single-value insert. |
| `withQuote` · `withNewLine` · `insertRandomText.outputFormat` | **Ignored.** Quoting/escaping is shape-driven — language-aware wrapping would corrupt the record. |

---

## Data Catalog

The generator registry (`catalog.ts`) is the single source of truth — it drives generation, the contributed commands, and the Quick Pick. **137 visible generators across 20 categories**, plus **6 hidden back-compat variants**. Groups appear in the order their first member is registered (which is the Quick Pick heading order). Every value is produced by the listed faker call; numeric and boolean generators are coerced to strings before insertion.

### Identity (17)

| Label | id | Command | faker source |
|---|---|---|---|
| Full Name | `person` | `extension.insertRandomPerson` | `person.fullName()` |
| First Name | `firstName` | `insertRandomText.firstName` | `person.firstName()` |
| Middle Name | `middleName` | `insertRandomText.middleName` | `person.middleName()` |
| Last Name | `lastName` | `insertRandomText.lastName` | `person.lastName()` |
| Name Prefix | `prefix` | `insertRandomText.prefix` | `person.prefix()` |
| Name Suffix | `suffix` | `insertRandomText.suffix` | `person.suffix()` |
| Username | `username` | `insertRandomText.username` | `internet.username()` |
| Display Name | `displayName` | `insertRandomText.displayName` | `internet.displayName()` |
| Email | `email` | `insertRandomText.email` | `internet.email()` |
| Phone | `phone` | `insertRandomText.phone` | `phone.number()` |
| Sex | `sex` | `insertRandomText.sex` | `person.sex()` |
| Gender | `gender` | `insertRandomText.gender` | `person.gender()` |
| Bio | `bio` | `insertRandomText.bio` | `person.bio()` |
| Zodiac Sign | `zodiac` | `insertRandomText.zodiac` | `person.zodiacSign()` |
| Job Title | `jobTitle` | `insertRandomText.jobTitle` | `person.jobTitle()` |
| Job Type | `jobType` | `insertRandomText.jobType` | `person.jobType()` |
| Job Area | `jobArea` | `insertRandomText.jobArea` | `person.jobArea()` |

### Numbers (6)

| Label | id | Command | faker source |
|---|---|---|---|
| Number | `number` | `extension.insertRandomNumber` | `number.int({ min: 0, max: 1000 })` |
| Float | `float` | `insertRandomText.float` | `number.float({ min: 0, max: 1000, fractionDigits: 2 })` → `toFixed(2)` |
| Boolean | `boolean` | `insertRandomText.boolean` | `datatype.boolean()` |
| Hex Number | `hexNumber` | `insertRandomText.hexNumber` | `number.hex({ max: 0xffffff })` |
| Binary Number | `binary` | `insertRandomText.binary` | `number.binary({ max: 255 })` |
| Octal Number | `octal` | `insertRandomText.octal` | `number.octal({ max: 511 })` |

### Text (12)

| Label | id | Command | faker source |
|---|---|---|---|
| String | `string` | `extension.insertRandomString` | `string.alphanumeric(15)` |
| Alpha String | `alpha` | `insertRandomText.alpha` | `string.alpha(10)` |
| Numeric String | `numeric` | `insertRandomText.numeric` | `string.numeric(10)` |
| Word | `word` | `insertRandomText.word` | `lorem.word()` |
| Words | `words` | `insertRandomText.words` | `lorem.words({ min: 3, max: 6 })` |
| Sentence | `sentence` | `insertRandomText.sentence` | `lorem.sentence()` |
| Slug | `slug` | `insertRandomText.slug` | `lorem.slug()` |
| Lorem Paragraph | `lorem` | `extension.insertLorem` | `lorem.paragraph()` |
| Hacker Phrase | `hackerPhrase` | `insertRandomText.hackerPhrase` | `hacker.phrase()` |
| Emoji | `emoji` | `insertRandomText.emoji` | `internet.emoji()` |
| Book Title | `bookTitle` | `insertRandomText.bookTitle` | `book.title()` |
| Book Author | `bookAuthor` | `insertRandomText.bookAuthor` | `book.author()` |

### Time (8)

The six timestamp types draw a `Date` and render it per the [`insertRandomText.dateFormat`](#configuration-reference) setting (default `iso` — the full ISO 8601 string, matching pre-setting behavior). Weekday and Month emit names, not timestamps, and are unaffected.

| Label | id | Command | faker source |
|---|---|---|---|
| Date | `date` | `extension.insertRandomDate` | `date.anytime()`, rendered per `dateFormat` |
| Past Date | `pastDate` | `insertRandomText.pastDate` | `date.past()`, rendered per `dateFormat` |
| Future Date | `futureDate` | `insertRandomText.futureDate` | `date.future()`, rendered per `dateFormat` |
| Recent Date | `recentDate` | `insertRandomText.recentDate` | `date.recent()`, rendered per `dateFormat` |
| Soon Date | `soonDate` | `insertRandomText.soonDate` | `date.soon()`, rendered per `dateFormat` |
| Birthdate | `birthdate` | `insertRandomText.birthdate` | `date.birthdate()`, rendered per `dateFormat` |
| Weekday | `weekday` | `insertRandomText.weekday` | `date.weekday()` |
| Month | `month` | `insertRandomText.month` | `date.month()` |

### Location (15)

| Label | id | Command | faker source |
|---|---|---|---|
| Country | `country` | `extension.insertRandomCountry` | `location.country()` |
| Country Code | `countryCode` | `insertRandomText.countryCode` | `location.countryCode()` |
| State | `state` | `insertRandomText.state` | `location.state()` |
| State Abbreviation | `stateAbbr` | `insertRandomText.stateAbbr` | `location.state({ abbreviated: true })` |
| County | `county` | `insertRandomText.county` | `location.county()` |
| City | `city` | `insertRandomText.city` | `location.city()` |
| Zip Code | `zipCode` | `insertRandomText.zipCode` | `location.zipCode()` |
| Street Name | `street` | `insertRandomText.street` | `location.street()` |
| Street Address | `address` | `insertRandomText.address` | `location.streetAddress()` |
| Secondary Address | `secondaryAddress` | `insertRandomText.secondaryAddress` | `location.secondaryAddress()` |
| Building Number | `buildingNumber` | `insertRandomText.buildingNumber` | `location.buildingNumber()` |
| Direction | `direction` | `insertRandomText.direction` | `location.direction()` |
| Latitude | `latitude` | `insertRandomText.latitude` | `location.latitude()` |
| Longitude | `longitude` | `insertRandomText.longitude` | `location.longitude()` |
| Time Zone | `timeZone` | `insertRandomText.timeZone` | `location.timeZone()` |

### Network (11)

| Label | id | Command | faker source |
|---|---|---|---|
| IP Address | `ipv4` | `insertRandomText.ipv4` | `internet.ipv4()` |
| IPv6 Address | `ipv6` | `insertRandomText.ipv6` | `internet.ipv6()` |
| MAC Address | `mac` | `insertRandomText.mac` | `internet.mac()` |
| URL | `url` | `insertRandomText.url` | `internet.url()` |
| Domain Name | `domainName` | `insertRandomText.domainName` | `internet.domainName()` |
| Port | `port` | `insertRandomText.port` | `internet.port()` |
| Protocol | `protocol` | `insertRandomText.protocol` | `internet.protocol()` |
| HTTP Method | `httpMethod` | `insertRandomText.httpMethod` | `internet.httpMethod()` |
| HTTP Status Code | `httpStatus` | `insertRandomText.httpStatus` | `internet.httpStatusCode()` |
| User Agent | `userAgent` | `insertRandomText.userAgent` | `internet.userAgent()` |
| JWT | `jwt` | `insertRandomText.jwt` | `internet.jwt()` |

### Media (2)

| Label | id | Command | faker source |
|---|---|---|---|
| Image URL | `imageUrl` | `insertRandomText.imageUrl` | `image.url()` |
| Avatar URL | `avatarUrl` | `insertRandomText.avatarUrl` | `image.avatar()` |

### Design (4)

| Label | id | Command | faker source |
|---|---|---|---|
| Color (hex) | `color` | `insertRandomText.color` | `color.rgb({ format: 'hex' })` |
| Color (rgb) | `rgb` | `insertRandomText.rgb` | `color.rgb({ format: 'css' })` |
| Color (hsl) | `hsl` | `insertRandomText.hsl` | `color.hsl({ format: 'css' })` |
| Color Name | `colorName` | `insertRandomText.colorName` | `color.human()` |

### Security (1)

| Label | id | Command | faker source |
|---|---|---|---|
| Password | `password` | `insertRandomText.password` | `internet.password()` |

### IDs (5)

| Label | id | Command | faker source |
|---|---|---|---|
| UUID | `uuid` | `insertRandomText.uuid` | `string.uuid()` |
| ULID | `ulid` | `insertRandomText.ulid` | `string.ulid()` |
| Nano ID | `nanoid` | `insertRandomText.nanoid` | `string.nanoid()` |
| MongoDB ObjectId | `mongodbObjectId` | `insertRandomText.mongodbObjectId` | `database.mongodbObjectId()` |
| Hash | `hash` | `extension.insertRandomHash` | `string.hexadecimal({ length: 13, casing: 'lower', prefix: '' })` |

### Nature (6)

| Label | id | Command | faker source |
|---|---|---|---|
| Animal | `animal` | `extension.insertRandomAnimal` | `animal.type()` |
| Dog Breed | `dog` | `insertRandomText.dog` | `animal.dog()` |
| Cat Breed | `cat` | `insertRandomText.cat` | `animal.cat()` |
| Bird Species | `bird` | `insertRandomText.bird` | `animal.bird()` |
| Fish Species | `fish` | `insertRandomText.fish` | `animal.fish()` |
| Horse Breed | `horse` | `insertRandomText.horse` | `animal.horse()` |

### Company (3)

| Label | id | Command | faker source |
|---|---|---|---|
| Company Name | `company` | `insertRandomText.company` | `company.name()` |
| Catch Phrase | `catchPhrase` | `insertRandomText.catchPhrase` | `company.catchPhrase()` |
| Buzz Phrase | `buzzPhrase` | `insertRandomText.buzzPhrase` | `company.buzzPhrase()` |

### Commerce (7)

| Label | id | Command | faker source |
|---|---|---|---|
| Product | `product` | `insertRandomText.product` | `commerce.product()` |
| Product Name | `productName` | `insertRandomText.productName` | `commerce.productName()` |
| Price | `price` | `insertRandomText.price` | `commerce.price()` |
| Department | `department` | `insertRandomText.department` | `commerce.department()` |
| Product Material | `productMaterial` | `insertRandomText.productMaterial` | `commerce.productMaterial()` |
| Product Description | `productDescription` | `insertRandomText.productDescription` | `commerce.productDescription()` |
| ISBN | `isbn` | `insertRandomText.isbn` | `commerce.isbn()` |

### Finance (13)

| Label | id | Command | faker source |
|---|---|---|---|
| Amount | `amount` | `insertRandomText.amount` | `finance.amount()` |
| Currency Code | `currencyCode` | `insertRandomText.currencyCode` | `finance.currencyCode()` |
| Currency Name | `currencyName` | `insertRandomText.currencyName` | `finance.currencyName()` |
| Currency Symbol | `currencySymbol` | `insertRandomText.currencySymbol` | `finance.currencySymbol()` |
| Credit Card Number | `creditCard` | `insertRandomText.creditCard` | `finance.creditCardNumber()` |
| Credit Card CVV | `creditCardCVV` | `insertRandomText.creditCardCVV` | `finance.creditCardCVV()` |
| IBAN | `iban` | `insertRandomText.iban` | `finance.iban()` |
| BIC | `bic` | `insertRandomText.bic` | `finance.bic()` |
| Account Number | `accountNumber` | `insertRandomText.accountNumber` | `finance.accountNumber()` |
| Routing Number | `routingNumber` | `insertRandomText.routingNumber` | `finance.routingNumber()` |
| Bitcoin Address | `bitcoin` | `insertRandomText.bitcoin` | `finance.bitcoinAddress()` |
| Ethereum Address | `ethereum` | `insertRandomText.ethereum` | `finance.ethereumAddress()` |
| PIN | `pin` | `insertRandomText.pin` | `finance.pin()` |

### Git (3)

| Label | id | Command | faker source |
|---|---|---|---|
| Git Branch | `gitBranch` | `insertRandomText.gitBranch` | `git.branch()` |
| Git Commit SHA | `gitCommitSha` | `insertRandomText.gitCommitSha` | `git.commitSha()` |
| Git Commit Message | `gitCommitMessage` | `insertRandomText.gitCommitMessage` | `git.commitMessage()` |

### System (6)

| Label | id | Command | faker source |
|---|---|---|---|
| File Name | `fileName` | `insertRandomText.fileName` | `system.fileName()` |
| File Path | `filePath` | `insertRandomText.filePath` | `system.filePath()` |
| File Extension | `fileExt` | `insertRandomText.fileExt` | `system.fileExt()` |
| MIME Type | `mimeType` | `insertRandomText.mimeType` | `system.mimeType()` |
| Semver | `semver` | `insertRandomText.semver` | `system.semver()` |
| Cron Expression | `cron` | `insertRandomText.cron` | `system.cron()` |

### Vehicle (5)

| Label | id | Command | faker source |
|---|---|---|---|
| Vehicle | `vehicle` | `insertRandomText.vehicle` | `vehicle.vehicle()` |
| Vehicle Manufacturer | `vehicleManufacturer` | `insertRandomText.vehicleManufacturer` | `vehicle.manufacturer()` |
| Vehicle Model | `vehicleModel` | `insertRandomText.vehicleModel` | `vehicle.model()` |
| VIN | `vin` | `insertRandomText.vin` | `vehicle.vin()` |
| License Plate (VRM) | `vrm` | `insertRandomText.vrm` | `vehicle.vrm()` |

### Food (5)

| Label | id | Command | faker source |
|---|---|---|---|
| Dish | `dish` | `insertRandomText.dish` | `food.dish()` |
| Ingredient | `ingredient` | `insertRandomText.ingredient` | `food.ingredient()` |
| Fruit | `fruit` | `insertRandomText.fruit` | `food.fruit()` |
| Vegetable | `vegetable` | `insertRandomText.vegetable` | `food.vegetable()` |
| Cuisine | `cuisine` | `insertRandomText.cuisine` | `food.ethnicCategory()` |

### Music (4)

| Label | id | Command | faker source |
|---|---|---|---|
| Song Name | `songName` | `insertRandomText.songName` | `music.songName()` |
| Music Genre | `musicGenre` | `insertRandomText.musicGenre` | `music.genre()` |
| Artist | `artist` | `insertRandomText.artist` | `music.artist()` |
| Album | `album` | `insertRandomText.album` | `music.album()` |

### Travel (4)

| Label | id | Command | faker source |
|---|---|---|---|
| Airline | `airline` | `insertRandomText.airline` | `airline.airline().name` |
| Airport | `airport` | `insertRandomText.airport` | `airline.airport().name` |
| Flight Number | `flightNumber` | `insertRandomText.flightNumber` | `airline.flightNumber({ addLeadingZeros: true })` |
| Seat | `seat` | `insertRandomText.seat` | `airline.seat()` |

### Hidden back-compat variants (6)

These carry `hidden: true` — they never appear in the Quick Pick and exist only to serve their legacy size-variant commands.

| Label | id | Command | faker source |
|---|---|---|---|
| Lorem (small) | `loremSmall` | `extension.insertLoremSmall` | `lorem.sentence()` |
| Lorem (medium) | `loremMedium` | `extension.insertLoremMedium` | `lorem.paragraph()` |
| Lorem (large) | `loremLarge` | `extension.insertLoremLarge` | `lorem.paragraphs(3)` |
| Hash (7) | `hashSmall` | `extension.insertRandomHashSmall` | `string.hexadecimal({ length: 7, casing: 'lower', prefix: '' })` |
| Hash (17) | `hashMedium` | `extension.insertRandomHashMedium` | `string.hexadecimal({ length: 17, casing: 'lower', prefix: '' })` |
| Hash (27) | `hashLarge` | `extension.insertRandomHashLarge` | `string.hexadecimal({ length: 27, casing: 'lower', prefix: '' })` |

---

## Configuration Reference

Eleven settings. Three **legacy** keys stay flat and non-namespaced (`insertType`, `withQuote`, `withNewLine`) for back-compat with existing user settings; every newer key is namespaced under `insertRandomText.*`. All are read into a typed `Settings` snapshot by `configuration.ts` (the `insertType` enum is normalized to a target there). One further key — `insertRandomText.contextMenu.enabled` — is consumed by a `package.json` `when` clause rather than read in code (see [Context Menu](#context-menu)).

| Setting | Type | Default | Values | Notes |
|---|---|---|---|---|
| `insertType` | string (enum) | `Cursor` | `Cursor` · `Top` · `Clipboard` | Where values go — normalized to `cursor` / `top` / `clipboard`. See [Insert Targets](#insert-targets). |
| `withQuote` | boolean | `true` | `true` / `false` | Wrap each value in quotes. Master switch for the quote policy. |
| `withNewLine` | boolean | `true` | `true` / `false` | Append a newline (`\n`) after each block. |
| `insertRandomText.uniquePerCursor` | boolean | `true` | `true` / `false` | A different value at each cursor, or the same value repeated. |
| `insertRandomText.bulkCount` | number | `1` | `1`–`1000` | How many values to insert at each cursor. Clamped to ≥ 1 at render time. |
| `insertRandomText.outputFormat` | string (enum) | `plain` | `plain` · `jsonArray` · `quotedList` | How bulk values render. See [Output Formats](#output-formats). |
| `insertRandomText.dateFormat` | string (enum) | `iso` | `iso` · `isoDate` · `isoTime` · `unixSeconds` · `unixMillis` | How the timestamp [Time types](#time-8) render — full ISO 8601, `YYYY-MM-DD`, `HH:mm:ss`, or Unix seconds/milliseconds. ISO slices come from the UTC string; an unknown value falls back to `iso`. |
| `insertRandomText.seed` | string | `""` | any number, or blank | Reproducible output; blank or non-numeric = random. See [Seeding](#seeding--reproducibility). |
| `insertRandomText.recordFormat` | string (enum) | `json` | `json` · `sql` · `csv` | Structured shape for [Record](#multi-field-records) inserts: JSON object, SQL row, or CSV line. |
| `insertRandomText.recordSqlTable` | string | `table` | any non-empty name | Table name used by the `sql` record shape. |
| `insertRandomText.contextMenu.enabled` | boolean | `false` | `true` / `false` | Show the "Insert Random" editor right-click submenu. Read by a `when` clause, not by code. |

---

## Settings Commands

`settingsCommands.ts` contributes 12 palette commands that **write** settings — so every setting is changeable without opening the Settings UI. Each is registered in `extension.ts` from a `SETTING_COMMANDS` map.

| Command | Title | Mechanism |
|---|---|---|
| `insertRandomText.setInsertType` | Set Insert Type | Quick Pick over `Cursor` / `Top` / `Clipboard`. |
| `insertRandomText.setOutputFormat` | Set Output Format | Quick Pick over `Plain` / `JSON array` / `Quoted list`. |
| `insertRandomText.setDateFormat` | Set Date Format | Quick Pick over `ISO 8601 timestamp` / `ISO date` / `ISO time` / `Unix seconds` / `Unix milliseconds`. |
| `insertRandomText.setRecordFormat` | Set Record Format | Quick Pick over `JSON object` / `SQL row` / `CSV line`. |
| `insertRandomText.setRecordSqlTable` | Set Record SQL Table | Input box; rejects an empty table name. |
| `insertRandomText.setBulkCount` | Set Bulk Count | Input box; validates a whole number `1`–`1000`. |
| `insertRandomText.setSeed` | Set Seed | Input box; validates a number, or blank for random. |
| `insertRandomText.toggleQuotes` | Toggle Wrap With Quotes | Flip `withQuote`. |
| `insertRandomText.toggleNewLine` | Toggle Trailing New Line | Flip `withNewLine`. |
| `insertRandomText.toggleUniquePerCursor` | Toggle Unique Value Per Cursor | Flip `insertRandomText.uniquePerCursor`. |
| `insertRandomText.toggleContextMenu` | Toggle Editor Context Menu | Flip `insertRandomText.contextMenu.enabled`. |
| `insertRandomText.resetSettings` | Reset Settings to Defaults | Modal-confirmed reset of every key. |

### Write target

Writes go to the **open workspace** when one is present (so a change is visible immediately even where a workspace pins the setting, and project tweaks stay project-scoped), otherwise to **global** user settings. Determined by `vscode.workspace.workspaceFolders?.length > 0`.

### Enum picker behavior

The enum pickers (`setInsertType` / `setOutputFormat` / `setDateFormat` / `setRecordFormat`) mark the current value with a `$(check) Current` description and float it to the top of the list; `matchOnDetail` is on, so typing filters against each option's one-line detail. Selecting writes the value and shows a `$(check) <title> → <label>` status-bar confirmation. Escape cancels with no write.

### Reset

`resetSettings` shows a **modal** warning — *"Reset all Insert Random settings to their defaults?"* — with a single **Reset** button. Only on confirm does it clear every key (all ten `ConfigKey` entries **plus** `insertRandomText.contextMenu.enabled`) by writing `undefined`, which restores each to its package.json default, then confirms via the status bar. Dismissing the dialog changes nothing.

---

## UX & Notifications

The extension is deliberately quiet. It uses **status-bar messages** (not modal/toast popups) for confirmations, and inserts silently.

| Event | Feedback |
|---|---|
| Cursor / Top insert | **Silent** — no message; the inserted text is the feedback. |
| Clipboard insert | Status bar: `$(clippy) Copied random <label> to clipboard` (~2.5s). |
| Setting changed (any settings command) | Status bar: `$(check) <message>` (~2.5s) — e.g. `Wrap with quotes: On`, `Bulk count → 25`, `Seed → 42`, `Seed cleared (random)`. |
| Settings reset confirmed | Status bar: `$(check) Insert Random settings reset to defaults`. |
| Reset requested | Modal warning dialog with a **Reset** button (see [Reset](#settings-commands)). |
| `setBulkCount` invalid input | Inline input-box validation: *"Enter a whole number between 1 and 1000."* |
| `setSeed` invalid input | Inline input-box validation: *"Enter a number, or leave blank for random."* |
| `setRecordSqlTable` invalid input | Inline input-box validation: *"Enter a table name."* |
| No active editor (Cursor / Top / Record…) | **Silent no-op** — nothing is inserted and no message is shown. |
| Record… pick cancelled or empty | **Silent no-op** — nothing is inserted. |

### Quick Pick behaviors

- **Insert Random: Pick…** — entries grouped under category separator headings (visible generators only), placeholder *"Insert Random — pick a type to insert at every cursor…"*, `matchOnDescription` on (search by label **or** registry id). Selecting inserts; Escape cancels.
- **Insert Random: Record…** — the same grouped listing in **multi-select** mode (`canPickMany`), placeholder *"Pick fields for the record…"*; ticked fields compose one record in catalog order. Escape, or confirming with nothing ticked, cancels.
- **Enum settings pickers** — current value marked `$(check) Current` and floated to the top; `matchOnDetail` on.

---

## Configuration Flow

`extension.ts` holds a **single module-level `settings` snapshot**. On activation, `watchConfiguration()` reads it once via `Configuration.read()`, then subscribes to `workspace.onDidChangeConfiguration`; when an event affects any key in `CONFIG_KEYS` (the nine `ConfigKey` values), the whole snapshot is re-read and replaced wholesale. Commands read this **cached** snapshot at invocation — they never re-read individual settings — so anything that bypasses `watchConfiguration` would see stale config.

`insertRandomText.contextMenu.enabled` is intentionally **not** in `CONFIG_KEYS`: it never influences generation, only the menu's `when` clause, which VS Code re-evaluates natively when the value changes.

---

## Context Menu

An optional editor right-click entry, **off by default**.

- A submenu `insertRandomText.contextSubmenu` labeled **"Insert Random"** is contributed to `editor/context` in group `1_modification`, gated by `when: editorTextFocus && config.insertRandomText.contextMenu.enabled`.
- Enable it via *Insert Random: Toggle Editor Context Menu* (or the `insertRandomText.contextMenu.enabled` setting).
- Submenu contents (a curated shortlist, not the whole catalog):

| Group | Items |
|---|---|
| `1_pick` | Insert Random: Pick… |
| `2_common` | UUID · Full Name · Email · Number · Date |
| `3_text` | Lorem |

---

## Activation & Engine

- **Activation** — the extension contributes **no explicit `activationEvents`**; since VS Code 1.74 they are auto-generated from `contributes.commands`, so invoking any of the 153 commands activates the extension from a cold start. `extensionKind` is `workspace`.
- **Trust & virtual workspaces** — `capabilities.untrustedWorkspaces.supported = true` and `virtualWorkspaces = true`: the extension runs in restricted/untrusted and virtual (no-filesystem) workspaces, because it neither reads project files nor makes network calls.
- **faker lifecycle** — `engine.ts` loads faker **lazily** on the first command via `load()`, a dynamic `import('@faker-js/faker/locale/en')` that is idempotent (guarded by a module-level `instance`). Only the single-locale `/locale/en` entry is imported — never the package root — so the other 60+ locales never reach the esbuild bundle (which would blow the `.vsix` size gate). `seed(value)` forwards to `faker().seed(value)`.
- **Privacy** — every value is generated in-process. No network requests, no telemetry, fully offline.
