import type { Faker } from '@faker-js/faker' with { 'resolution-mode': 'import' };

/**
 * faker lifecycle for the extension.
 *
 * faker v10 ships as pure ESM. Under the project's `module: Node16` setting a
 * *static* `import` from these CommonJS-emitted files fails to type-check
 * (TS1479), so the instance is loaded through a dynamic `import()` that esbuild
 * inlines into the single CJS bundle. Only the `/locale/en` entry is imported —
 * never the package root — so the other 60+ locales never reach the bundle.
 */

let instance: Faker | undefined;

/** Load faker on first use. Idempotent and safe to call before every command. */
export async function load(): Promise<void> {
  if (!instance) {
    ({ faker: instance } = await import('@faker-js/faker/locale/en'));
  }
}

/**
 * The loaded faker instance. Throws if called before {@link load} has resolved —
 * generators only ever run after activation has awaited `load()`.
 */
export function faker(): Faker {
  if (!instance) {
    throw new Error('engine.faker() called before load(); await load() first.');
  }
  return instance;
}

/**
 * Seed the underlying RNG. The same seed reproduces the same sequence of values;
 * omit the argument to reseed randomly.
 */
export function seed(value?: number): void {
  faker().seed(value);
}
