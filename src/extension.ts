import * as vscode from 'vscode';
import { ConfigKey, Configuration, Settings } from './configuration';
import { Generator, generators, getGenerator } from './catalog';
import { load, seed } from './engine';
import { buildBlocks, InsertOptions, OutputFormat } from './formatter';
import { resolveQuotePolicy } from './quotePolicy';
import { buildRecords, RecordShape } from './record';
import { SETTING_COMMANDS } from './settingsCommands';

const PICK_COMMAND = 'insertRandomText.pick';
const RECORD_COMMAND = 'insertRandomText.record';
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
  // v1.0.0 breadth pass — id === command suffix for every entry below.
  // Identity
  'insertRandomText.middleName': 'middleName',
  'insertRandomText.prefix': 'prefix',
  'insertRandomText.suffix': 'suffix',
  'insertRandomText.sex': 'sex',
  'insertRandomText.gender': 'gender',
  'insertRandomText.jobTitle': 'jobTitle',
  'insertRandomText.jobType': 'jobType',
  'insertRandomText.jobArea': 'jobArea',
  'insertRandomText.bio': 'bio',
  'insertRandomText.zodiac': 'zodiac',
  // Network
  'insertRandomText.ipv6': 'ipv6',
  'insertRandomText.port': 'port',
  'insertRandomText.httpMethod': 'httpMethod',
  'insertRandomText.httpStatus': 'httpStatus',
  'insertRandomText.userAgent': 'userAgent',
  'insertRandomText.domainName': 'domainName',
  'insertRandomText.emoji': 'emoji',
  'insertRandomText.protocol': 'protocol',
  'insertRandomText.jwt': 'jwt',
  'insertRandomText.displayName': 'displayName',
  // Company
  'insertRandomText.company': 'company',
  'insertRandomText.catchPhrase': 'catchPhrase',
  'insertRandomText.buzzPhrase': 'buzzPhrase',
  // Commerce
  'insertRandomText.product': 'product',
  'insertRandomText.productName': 'productName',
  'insertRandomText.price': 'price',
  'insertRandomText.department': 'department',
  'insertRandomText.productMaterial': 'productMaterial',
  'insertRandomText.productDescription': 'productDescription',
  'insertRandomText.isbn': 'isbn',
  // Finance
  'insertRandomText.amount': 'amount',
  'insertRandomText.currencyCode': 'currencyCode',
  'insertRandomText.currencyName': 'currencyName',
  'insertRandomText.currencySymbol': 'currencySymbol',
  'insertRandomText.creditCard': 'creditCard',
  'insertRandomText.creditCardCVV': 'creditCardCVV',
  'insertRandomText.iban': 'iban',
  'insertRandomText.bic': 'bic',
  'insertRandomText.accountNumber': 'accountNumber',
  'insertRandomText.routingNumber': 'routingNumber',
  'insertRandomText.bitcoin': 'bitcoin',
  'insertRandomText.ethereum': 'ethereum',
  'insertRandomText.pin': 'pin',
  // Location
  'insertRandomText.zipCode': 'zipCode',
  'insertRandomText.state': 'state',
  'insertRandomText.stateAbbr': 'stateAbbr',
  'insertRandomText.countryCode': 'countryCode',
  'insertRandomText.latitude': 'latitude',
  'insertRandomText.longitude': 'longitude',
  'insertRandomText.timeZone': 'timeZone',
  'insertRandomText.county': 'county',
  'insertRandomText.street': 'street',
  'insertRandomText.secondaryAddress': 'secondaryAddress',
  'insertRandomText.buildingNumber': 'buildingNumber',
  'insertRandomText.direction': 'direction',
  // Time
  'insertRandomText.pastDate': 'pastDate',
  'insertRandomText.futureDate': 'futureDate',
  'insertRandomText.recentDate': 'recentDate',
  'insertRandomText.soonDate': 'soonDate',
  'insertRandomText.birthdate': 'birthdate',
  'insertRandomText.weekday': 'weekday',
  'insertRandomText.month': 'month',
  // Numbers
  'insertRandomText.float': 'float',
  'insertRandomText.hexNumber': 'hexNumber',
  'insertRandomText.binary': 'binary',
  'insertRandomText.octal': 'octal',
  // IDs
  'insertRandomText.nanoid': 'nanoid',
  'insertRandomText.ulid': 'ulid',
  // Text
  'insertRandomText.alpha': 'alpha',
  'insertRandomText.numeric': 'numeric',
  'insertRandomText.hackerPhrase': 'hackerPhrase',
  'insertRandomText.slug': 'slug',
  'insertRandomText.words': 'words',
  'insertRandomText.bookTitle': 'bookTitle',
  'insertRandomText.bookAuthor': 'bookAuthor',
  // Git
  'insertRandomText.gitBranch': 'gitBranch',
  'insertRandomText.gitCommitSha': 'gitCommitSha',
  'insertRandomText.gitCommitMessage': 'gitCommitMessage',
  // System
  'insertRandomText.fileName': 'fileName',
  'insertRandomText.filePath': 'filePath',
  'insertRandomText.fileExt': 'fileExt',
  'insertRandomText.mimeType': 'mimeType',
  'insertRandomText.semver': 'semver',
  'insertRandomText.cron': 'cron',
  // Design
  'insertRandomText.rgb': 'rgb',
  'insertRandomText.hsl': 'hsl',
  'insertRandomText.colorName': 'colorName',
  // Vehicle
  'insertRandomText.vehicle': 'vehicle',
  'insertRandomText.vehicleManufacturer': 'vehicleManufacturer',
  'insertRandomText.vehicleModel': 'vehicleModel',
  'insertRandomText.vin': 'vin',
  'insertRandomText.vrm': 'vrm',
  // Food
  'insertRandomText.dish': 'dish',
  'insertRandomText.ingredient': 'ingredient',
  'insertRandomText.fruit': 'fruit',
  'insertRandomText.vegetable': 'vegetable',
  'insertRandomText.cuisine': 'cuisine',
  // Music
  'insertRandomText.songName': 'songName',
  'insertRandomText.musicGenre': 'musicGenre',
  'insertRandomText.artist': 'artist',
  'insertRandomText.album': 'album',
  // Nature
  'insertRandomText.dog': 'dog',
  'insertRandomText.cat': 'cat',
  'insertRandomText.bird': 'bird',
  'insertRandomText.fish': 'fish',
  'insertRandomText.horse': 'horse',
  // Travel
  'insertRandomText.airline': 'airline',
  'insertRandomText.airport': 'airport',
  'insertRandomText.flightNumber': 'flightNumber',
  'insertRandomText.seat': 'seat',
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

/**
 * Derive the formatter options from the current settings, resolving the quote +
 * escape from the active file's language (automatic and always on).
 * `languageId` is undefined when there is no active editor (e.g. clipboard).
 */
function currentInsertOptions(languageId?: string): InsertOptions {
  const policy = resolveQuotePolicy(languageId, { withQuote: settings.withQuote });
  return {
    quote: policy.quote,
    escape: policy.escape,
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
  const languageId = vscode.window.activeTextEditor?.document.languageId;
  const options = currentInsertOptions(languageId);

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

/**
 * "Insert Random: Record…" — multi-select fields from the catalog, then deliver
 * one composed record (JSON object / SQL row / CSV line per `recordFormat`) to
 * the configured insert target: every cursor, the top of the file, or the
 * clipboard. Honors `bulkCount`, `uniquePerCursor`, and `seed`. An empty or
 * cancelled pick inserts nothing; Cursor/Top with no active editor is a no-op.
 */
async function pickAndInsertRecord(): Promise<void> {
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

  const picks = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Pick fields for the record…',
    matchOnDescription: true,
  });
  if (!picks || picks.length === 0) { return; }

  // Preserve catalog order regardless of the order fields were ticked.
  const pickedIds = new Set(picks.map((pick) => pick.generatorId));
  const fields = generators.filter((generator) => !generator.hidden && pickedIds.has(generator.id));

  applySeed();
  const shape = settings.recordFormat as RecordShape;
  const options = { bulkCount: settings.bulkCount, sqlTable: settings.recordSqlTable };

  if (settings.insertType === 'clipboard') {
    // Clipboard: no editor needed. The record is copied as-is — its shape
    // (JSON/SQL/CSV) is already the final text, so nothing is stripped or wrapped.
    await vscode.env.clipboard.writeText(buildRecords(fields, shape, options));
    vscode.window.setStatusBarMessage('$(clippy) Copied random record to clipboard', 2500);
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) { return; }

  if (settings.insertType === 'top') {
    // Top: a single record block at line 1.
    await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), buildRecords(fields, shape, options)));
    return;
  }

  // Cursor: a record at every selection — the multi-cursor fill.
  const shared = settings.uniquePerCursor ? undefined : buildRecords(fields, shape, options);
  const { selections } = editor;
  await editor.edit((builder) => {
    selections.forEach((selection) => {
      builder.replace(selection, settings.uniquePerCursor ? buildRecords(fields, shape, options) : shared!);
    });
  });
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

  context.subscriptions.push(
    vscode.commands.registerCommand(RECORD_COMMAND, () => pickAndInsertRecord()),
  );

  // Settings commands — change any setting from the Command Palette (Quick Pick / toggle / input).
  for (const [ commandId, handler ] of Object.entries(SETTING_COMMANDS)) {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, handler));
  }
}

export function deactivate(): void { /* no teardown needed */ }
