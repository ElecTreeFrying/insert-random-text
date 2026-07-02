import * as vscode from 'vscode';
import { ConfigKey } from './configuration';

/** The context-menu setting isn't part of {@link ConfigKey} (it's consumed by a
 * package.json `when` clause, not read in code) — declared here for its toggle. */
const CONTEXT_MENU_KEY = 'insertRandomText.contextMenu.enabled';

/** One selectable option for an enum setting; `detail` mirrors the matching
 * `enumDescriptions` entry in package.json. */
interface EnumOption {
  readonly value: string;
  readonly label: string;
  readonly detail: string;
}

/**
 * Where a command writes: the open workspace if there is one — so the change is
 * visible immediately even when a workspace pins the setting (and project tweaks
 * stay project-scoped) — otherwise the user's global settings.
 */
function writeTarget(): vscode.ConfigurationTarget {
  return (vscode.workspace.workspaceFolders?.length ?? 0) > 0
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

function read<T>(key: string): T | undefined {
  return vscode.workspace.getConfiguration().get<T>(key);
}

function write(key: string, value: unknown): Thenable<void> {
  return vscode.workspace.getConfiguration().update(key, value, writeTarget());
}

/** Unobtrusive confirmation, matching the clipboard toast style in extension.ts. */
function confirm(message: string): void {
  vscode.window.setStatusBarMessage(`$(check) ${message}`, 2500);
}

/** Quick Pick over an enum setting: the current value floats to the top, marked. */
async function chooseEnum(title: string, key: string, options: readonly EnumOption[], fallback: string): Promise<void> {
  const current = read<string>(key) ?? fallback;
  const items: (vscode.QuickPickItem & { value: string })[] = options.map((option) => ({
    label: option.label,
    detail: option.detail,
    description: option.value === current ? '$(check) Current' : undefined,
    value: option.value,
  }));
  const currentIdx = items.findIndex((item) => item.value === current);
  if (currentIdx > 0) {
    const [ item ] = items.splice(currentIdx, 1);
    items.unshift(item);
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder: title, matchOnDetail: true });
  if (!picked) { return; }
  await write(key, picked.value);
  confirm(`${title} → ${picked.label}`);
}

/** Flip a boolean setting and report the new state. */
async function toggleBoolean(key: string, label: string, fallback: boolean): Promise<void> {
  const next = !(read<boolean>(key) ?? fallback);
  await write(key, next);
  confirm(`${label}: ${next ? 'On' : 'Off'}`);
}

const INSERT_TYPE_OPTIONS: readonly EnumOption[] = [
  { value: 'Cursor', label: 'Cursor', detail: 'Fill a fresh value at each cursor.' },
  { value: 'Top', label: 'Top', detail: 'Insert one block at line 1.' },
  { value: 'Clipboard', label: 'Clipboard', detail: 'Copy to the clipboard instead of inserting (no editor needed).' },
];

const OUTPUT_FORMAT_OPTIONS: readonly EnumOption[] = [
  { value: 'plain', label: 'Plain', detail: 'One value per line.' },
  { value: 'jsonArray', label: 'JSON array', detail: 'A JSON array, e.g. [ "a", "b" ].' },
  { value: 'quotedList', label: 'Quoted list', detail: 'A quoted, comma-separated list, e.g. "a", "b".' },
];

const RECORD_FORMAT_OPTIONS: readonly EnumOption[] = [
  { value: 'json', label: 'JSON object', detail: '{ "field": "value", … }' },
  { value: 'sql', label: 'SQL row', detail: 'INSERT INTO table (…) VALUES (…);' },
  { value: 'csv', label: 'CSV line', detail: 'value,value,…' },
];

const DATE_FORMAT_OPTIONS: readonly EnumOption[] = [
  { value: 'iso', label: 'ISO 8601 timestamp', detail: 'Full timestamp, e.g. 2026-07-02T12:34:56.789Z.' },
  { value: 'isoDate', label: 'ISO date', detail: 'Date only (YYYY-MM-DD), e.g. 2026-07-02.' },
  { value: 'isoTime', label: 'ISO time', detail: 'Time only (HH:mm:ss), e.g. 12:34:56.' },
  { value: 'unixSeconds', label: 'Unix seconds', detail: 'Unix time in seconds, e.g. 1783082096.' },
  { value: 'unixMillis', label: 'Unix milliseconds', detail: 'Unix time in milliseconds, e.g. 1783082096123.' },
];

async function setBulkCount(): Promise<void> {
  const current = read<number>(ConfigKey.BULK_COUNT) ?? 1;
  const input = await vscode.window.showInputBox({
    prompt: 'Bulk count — how many values to insert at each cursor (1–1000).',
    value: String(current),
    validateInput: (raw) => {
      const n = Number(raw);
      return Number.isInteger(n) && n >= 1 && n <= 1000 ? undefined : 'Enter a whole number between 1 and 1000.';
    },
  });
  if (input === undefined) { return; }
  await write(ConfigKey.BULK_COUNT, Number(input));
  confirm(`Bulk count → ${Number(input)}`);
}

async function setSeed(): Promise<void> {
  const current = read<string>(ConfigKey.SEED) ?? '';
  const input = await vscode.window.showInputBox({
    prompt: 'Seed — a number for reproducible output. Leave blank for random.',
    value: current,
    validateInput: (raw) => (raw.trim() === '' || !Number.isNaN(Number(raw)) ? undefined : 'Enter a number, or leave blank for random.'),
  });
  if (input === undefined) { return; }
  const seed = input.trim();
  await write(ConfigKey.SEED, seed);
  confirm(seed === '' ? 'Seed cleared (random)' : `Seed → ${seed}`);
}

async function setRecordSqlTable(): Promise<void> {
  const current = read<string>(ConfigKey.RECORD_SQL_TABLE) ?? 'table';
  const input = await vscode.window.showInputBox({
    prompt: 'Record SQL table — the table name used by the SQL record shape.',
    value: current,
    validateInput: (raw) => (raw.trim() === '' ? 'Enter a table name.' : undefined),
  });
  if (input === undefined) { return; }
  await write(ConfigKey.RECORD_SQL_TABLE, input.trim());
  confirm(`Record SQL table → ${input.trim()}`);
}

/** Open the Settings UI filtered to one key — the whole "manage" surface for the
 * settings-defined templates and custom lists (no bespoke editor UI). */
async function openSettingsAt(key: string): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', key);
}

// Saved templates and custom lists are user-authored content, not behavior tuning —
// a reset must never delete them (they stay editable via the Manage commands).
const RESET_KEEPS: readonly string[] = [ ConfigKey.TEMPLATES, ConfigKey.CUSTOM_LISTS ];

async function resetSettings(): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    'Reset all Insert Random settings to their defaults? Saved templates and custom lists are kept.',
    { modal: true },
    'Reset',
  );
  if (choice !== 'Reset') { return; }
  for (const key of [ ...Object.values(ConfigKey), CONTEXT_MENU_KEY ].filter((key) => !RESET_KEEPS.includes(key))) {
    await write(key, undefined);
  }
  confirm('Insert Random settings reset to defaults');
}

/** Command id → handler for every settings command. Registered in extension.ts. */
export const SETTING_COMMANDS: Readonly<Record<string, () => Promise<void>>> = {
  'insertRandomText.setInsertType': () => chooseEnum('Insert type', ConfigKey.INSERT_TYPE, INSERT_TYPE_OPTIONS, 'Cursor'),
  'insertRandomText.setOutputFormat': () => chooseEnum('Output format', ConfigKey.OUTPUT_FORMAT, OUTPUT_FORMAT_OPTIONS, 'plain'),
  'insertRandomText.setDateFormat': () => chooseEnum('Date format', ConfigKey.DATE_FORMAT, DATE_FORMAT_OPTIONS, 'iso'),
  'insertRandomText.setRecordFormat': () => chooseEnum('Record format', ConfigKey.RECORD_FORMAT, RECORD_FORMAT_OPTIONS, 'json'),
  'insertRandomText.setRecordSqlTable': setRecordSqlTable,
  'insertRandomText.setBulkCount': setBulkCount,
  'insertRandomText.setSeed': setSeed,
  'insertRandomText.toggleQuotes': () => toggleBoolean(ConfigKey.WITH_QUOTE, 'Wrap with quotes', true),
  'insertRandomText.toggleNewLine': () => toggleBoolean(ConfigKey.WITH_NEW_LINE, 'Trailing new line', true),
  'insertRandomText.toggleUniquePerCursor': () => toggleBoolean(ConfigKey.UNIQUE_PER_CURSOR, 'Unique value per cursor', true),
  'insertRandomText.toggleContextMenu': () => toggleBoolean(CONTEXT_MENU_KEY, 'Editor context menu', false),
  'insertRandomText.manageTemplates': () => openSettingsAt(ConfigKey.TEMPLATES),
  'insertRandomText.manageCustomLists': () => openSettingsAt(ConfigKey.CUSTOM_LISTS),
  'insertRandomText.resetSettings': resetSettings,
};
