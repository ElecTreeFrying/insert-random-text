import type { Faker } from '@faker-js/faker' with { 'resolution-mode': 'import' };

/**
 * faker lifecycle for the extension.
 *
 * faker v10 ships as pure ESM. Under the project's `module: Node16` setting a
 * *static* `import` from these CommonJS-emitted files fails to type-check
 * (TS1479), so each locale instance is loaded through a dynamic `import()` that
 * esbuild inlines into the single CJS bundle. Only the shipped `/locale/<id>`
 * entries are imported — never the package root — so the other 60+ locales
 * never reach the bundle.
 */

/** The locales the extension ships, exactly as faker spells them. */
export const LOCALES = [ 'en', 'de', 'fr', 'es', 'pt_BR', 'ja' ] as const;
export type LocaleId = (typeof LOCALES)[number];

/** The instance draws go through — whichever locale {@link load} last resolved. */
let active: Faker | undefined;

/** One import per locale, cached as promises so concurrent loads share a single import. */
const instances = new Map<LocaleId, Promise<Faker>>();

/**
 * esbuild only inlines an `import()` whose specifier is a string literal, so
 * every shipped locale needs its own literal here — deriving the path from the
 * id would leave the import unresolvable at bundle time.
 */
function importLocale(locale: LocaleId): Promise<{ faker: Faker }> {
  switch (locale) {
    case 'de': return import('@faker-js/faker/locale/de');
    case 'fr': return import('@faker-js/faker/locale/fr');
    case 'es': return import('@faker-js/faker/locale/es');
    case 'pt_BR': return import('@faker-js/faker/locale/pt_BR');
    case 'ja': return import('@faker-js/faker/locale/ja');
    default: return import('@faker-js/faker/locale/en');
  }
}

/**
 * Load faker and make `locale` the active instance. Idempotent and safe to call
 * before every command: the first call per locale performs the import, later
 * calls reuse the cached instance — so switching locales never needs a reload.
 */
export async function load(locale: LocaleId = 'en'): Promise<void> {
  let pending = instances.get(locale);
  if (!pending) {
    pending = importLocale(locale).then((module) => module.faker);
    instances.set(locale, pending);
  }
  active = await pending;
}

/**
 * The active faker instance. Throws if called before {@link load} has resolved —
 * generators only ever run after activation has awaited `load()`.
 */
export function faker(): Faker {
  if (!active) {
    throw new Error('engine.faker() called before load(); await load() first.');
  }
  return active;
}

/**
 * Seed the active instance's RNG. The same seed reproduces the same sequence of
 * values (per locale); omit the argument to reseed randomly.
 */
export function seed(value?: number): void {
  faker().seed(value);
}
