# Security Policy

## Supported versions

Only the **latest published version** of Random, Fake & Mock Data Generator receives
security fixes. Older versions are never patched in place — a fix ships as a new
release to both registries:

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ElecTreeFrying.insert-random-text)
- [Open VSX](https://open-vsx.org/extension/ElecTreeFrying/insert-random-text)

If you are reporting against an older version, please confirm the problem still
reproduces on the latest one first.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** A public report tells
everyone about the weakness before there is a fix available.

Email **electreefrying.git@gmail.com** with:

- what the problem is, and roughly how severe you think it is
- the extension version, your VS Code (or Cursor / VSCodium / Windsurf) version, and your OS
- steps to reproduce, or a proof of concept
- whether you would like to be credited in the release notes, and under what name

You can expect an acknowledgement as soon as I can manage it — usually within a week.
If the report is confirmed, I will let you know the fix timeline and tell you when the
patched version is live on both registries. If I conclude it is not a vulnerability,
I will explain why rather than going quiet.

This is a solo-maintained project, so please be patient with response times. There is
no bug bounty.

## Scope

This extension generates data **locally**. It makes **no network requests**, collects
**no telemetry**, and calls no model or remote service — every value comes from
`@faker-js/faker`, which is bundled into the shipped extension rather than fetched at
runtime.

**In scope:**

- Anything that turns user-supplied input into code execution. The two places worth
  looking hardest at are the `insertRandomText.templates` and
  `insertRandomText.customLists` settings, and the **From Template…** / **From
  Pattern…** commands — all of them pass user input to faker's `helpers.fake()` and
  `helpers.fromRegExp()`
- A crafted pattern that hangs or exhausts memory (catastrophic backtracking in
  **From Pattern…**, or a dataset size that escapes the row-count cap)
- Vulnerabilities in `@faker-js/faker` that reach the shipped bundle
- Anything that causes the extension to read or write files outside what the user asked for

**Out of scope:**

- Vulnerabilities in VS Code itself — report those to
  [Microsoft](https://github.com/microsoft/vscode/security/policy)
- Generated data being predictable. This is **not** a cryptographic random source and
  is not meant to be one: `insertRandomText.seed` deliberately makes output
  reproducible. Never use it for passwords, keys, or tokens that protect anything real
- Generated values that are merely *wrong* or unrealistic — ordinary bugs, please open
  a normal issue
- Anything requiring an attacker to already have local code execution on the machine

## Disclosure

Please give me a reasonable window to ship a fix before disclosing publicly. Once the
patched version is live on both registries, you are welcome to write about it — and
I will credit you in the release notes if you would like.
