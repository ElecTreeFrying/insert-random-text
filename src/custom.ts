import type { Generator } from './catalog';
import { faker } from './engine';

/**
 * User-defined data pools as generators: the `insertRandomText.templates` and
 * `insertRandomText.customLists` settings, wrapped as plain {@link Generator}
 * objects so they ride the exact same insert pipeline as the catalog — settings,
 * quoting, bulk, multi-cursor, and seed all apply. Pure (no `vscode` import):
 * extension.ts hands in the validated maps from the cached settings and lists
 * the wrapped generators at the top of the Pick… / Record… Quick Picks.
 *
 * The id is the bare user-chosen name (not prefixed): it doubles as the Record…
 * field key, so a list named `environment` becomes the `environment` JSON key /
 * SQL column. These generators never enter the catalog registry, so a name that
 * matches a catalog id shadows nothing.
 */

/** Quick Pick group heading for the saved templates. */
export const TEMPLATES_GROUP = 'Templates';

/** Quick Pick group heading for the custom lists. */
export const CUSTOM_LISTS_GROUP = 'Custom Lists';

/** Wrap each saved template as a Generator; a fresh render per generate() call. */
export function templateGenerators(templates: Readonly<Record<string, string>>): Generator[] {
  return Object.entries(templates).map(([ name, template ]) => ({
    id: name,
    label: name,
    group: TEMPLATES_GROUP,
    generate: () => faker().helpers.fake(template),
  }));
}

/** Wrap each custom list as a Generator; every generate() draws one random item. */
export function customListGenerators(lists: Readonly<Record<string, readonly string[]>>): Generator[] {
  return Object.entries(lists).map(([ name, values ]) => ({
    id: name,
    label: name,
    group: CUSTOM_LISTS_GROUP,
    generate: () => faker().helpers.arrayElement(values),
  }));
}
