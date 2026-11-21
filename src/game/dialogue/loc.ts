/**
 * Locale hooks -- every piece of NEW authored text (conversation beats,
 * choice labels, UI strings) can be written as an "@locale.key" indirection.
 * The table ships at /content/locales/en.json; adding a language later means
 * adding a locale file and swapping the table at boot -- no engine changes.
 * Legacy inline text (build one) passes through untouched.
 */

type LocaleTable = Record<string, string>;

let table: LocaleTable = {};

export function setLocaleTable(next: LocaleTable): void {
  table = next ?? {};
}

export function localeTable(): LocaleTable {
  return table;
}

/** Translate a key with optional {name} interpolation. Missing keys render as the key itself. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = table[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, name: string) => String(params[name] ?? `{${name}}`));
}

/**
 * Resolve an authored text: "@dlg.foo.bar" -> locale lookup; anything else
 * is returned as-is (with optional interpolation for inline text too).
 */
export function resolveText(text: string, params?: Record<string, string | number>): string {
  if (text && text.startsWith('@')) return t(text.slice(1), params);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_m, name: string) => String(params[name] ?? `{${name}}`));
}
