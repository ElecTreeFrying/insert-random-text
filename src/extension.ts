import * as vscode from 'vscode';
import { ConfigKey, Configuration, Settings } from './configuration';
import { Generator, generators, getGenerator } from './catalog';
import { load, seed } from './engine';
import { buildBlocks, InsertOptions, OutputFormat } from './formatter';

const SINGLE_QUOTE = "'";
const DOUBLE_QUOTE = '"';
const PICK_COMMAND = 'insertRandomText.pick';
const CONFIG_KEYS: readonly string[] = Object.values(ConfigKey);

/** Cached settings snapshot; replaced wholesale by {@link watchConfiguration}. */
let settings: Settings;

/**
 * Every contributed command id → the generator it inserts. The original
 * `extension.insertRandom*` ids are kept for back-compat (existing keybindings);
 * new types use namespaced `insertRandomText.*` ids. The Lorem/Hash size variants
 * point at dedicated hidden generators.
 */
const COMMAND_TO_GENERATOR: Readonly<Record<string, string>> = {
  // Original commands — kept for back-compat.
  'extension.insertRandomAnimal': 'animal',
  'extension.insertRandomPerson': 'person',
  'extension.insertRandomDate': 'date',
  'extension.insertRandomCountry': 'country',
  'extension.insertRandomNumber': 'number',
  'extension.insertRandomString': 'string',
  'extension.insertLorem': 'lorem',
  'extension.insertLoremSmall': 'loremSmall',
  'extension.insertLoremMedium': 'loremMedium',
  'extension.insertLoremLarge': 'loremLarge',
  'extension.insertRandomHash': 'hash',
  'extension.insertRandomHashSmall': 'hashSmall',
  'extension.insertRandomHashMedium': 'hashMedium',
  'extension.insertRandomHashLarge': 'hashLarge',
  // Modern commands for the broader catalog.
  'insertRandomText.uuid': 'uuid',
  'insertRandomText.email': 'email',
  'insertRandomText.username': 'username',
  'insertRandomText.boolean': 'boolean',
  'insertRandomText.firstName': 'firstName',
  'insertRandomText.lastName': 'lastName',
  'insertRandomText.phone': 'phone',
  'insertRandomText.city': 'city',
  'insertRandomText.address': 'address',
  'insertRandomText.ipv4': 'ipv4',
  'insertRandomText.mac': 'mac',
  'insertRandomText.url': 'url',
  'insertRandomText.color': 'color',
  'insertRandomText.password': 'password',
  'insertRandomText.word': 'word',
  'insertRandomText.sentence': 'sentence',
};

/** Seed the cached settings, then re-snapshot them whenever a relevant key changes. */
function watchConfiguration(context: vscode.ExtensionContext, reader = new Configuration(vscode.workspace)): void {
  settings = reader.read();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (CONFIG_KEYS.some((key) => event.affectsConfiguration(key))) {
        settings = reader.read();
      }
    }),
  );
}

/** Derive the formatter options from the current settings. */
function currentInsertOptions(): InsertOptions {
  return {
    quote: settings.withQuote ? (settings.quoteStyle ? SINGLE_QUOTE : DOUBLE_QUOTE) : '',
    newline: settings.withNewLine ? '\n' : '',
    uniquePerCursor: settings.uniquePerCursor,
    bulkCount: settings.bulkCount,
    outputFormat: settings.outputFormat as OutputFormat,
  };
}

/**
 * Apply the `seed` setting before a command runs. A non-empty numeric seed makes
 * output reproducible — the same seed yields the same values every time; anything
 * else (blank or non-numeric) leaves faker random.
 */
function applySeed(): void {
  const raw = settings.seed.trim();
  if (raw === '') { return; }
  const value = Number(raw);
  if (!Number.isNaN(value)) { seed(value); }
}

/** Deliver a generator's output to the editor cursor(s), top of file, or clipboard. */
async function insertGenerated(generatorId: string): Promise<void> {
  await load();

  const generator = getGenerator(generatorId);
  if (!generator) { return; }

  applySeed();
  const options = currentInsertOptions();

  if (settings.insertType === 'clipboard') {
    // Clipboard: no editor needed. Copy a bare value (no quote-wrap or trailing
    // newline, unless the output format is itself a list) and confirm unobtrusively.
    const [ value ] = buildBlocks(1, generator, {
      ...options,
      quote: options.outputFormat === 'quotedList' ? options.quote : '',
      newline: '',
      uniquePerCursor: false,
    });
    await vscode.env.clipboard.writeText(value);
    vscode.window.setStatusBarMessage(`$(clippy) Copied random ${generator.label.toLowerCase()} to clipboard`, 2500);
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) { return; }

  if (settings.insertType === 'top') {
    // Top: a single block at line 1.
    const [ block ] = buildBlocks(1, generator, { ...options, uniquePerCursor: false });
    await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), block));
  } else {
    // Cursor: a fresh block at every selection — the multi-cursor fill.
    const { selections } = editor;
    const blocks = buildBlocks(selections.length, generator, options);
    await editor.edit((builder) => {
      selections.forEach((selection, index) => builder.replace(selection, blocks[index]));
    });
  }
}

type GeneratorPick = vscode.QuickPickItem & { generatorId?: string };

/** "Insert Random: Pick…" — one entry point over the whole catalog, grouped by
 * category. The chosen generator runs through the same insert path. */
async function pickAndInsert(): Promise<void> {
  await load();

  const byGroup = new Map<string, Generator[]>();
  for (const generator of generators) {
    if (generator.hidden) { continue; }
    const members = byGroup.get(generator.group) ?? [];
    members.push(generator);
    byGroup.set(generator.group, members);
  }

  const items: GeneratorPick[] = [];
  for (const [ group, members ] of byGroup) {
    items.push({ label: group, kind: vscode.QuickPickItemKind.Separator });
    for (const generator of members) {
      items.push({ label: generator.label, description: generator.id, generatorId: generator.id });
    }
  }

  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: 'Insert Random — pick a type to insert at every cursor…',
    matchOnDescription: true,
  });
  if (choice?.generatorId) {
    await insertGenerated(choice.generatorId);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  watchConfiguration(context);

  for (const commandId of Object.keys(COMMAND_TO_GENERATOR)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, () => insertGenerated(COMMAND_TO_GENERATOR[commandId])),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(PICK_COMMAND, () => pickAndInsert()),
  );
}

export function deactivate(): void { /* no teardown needed */ }
