import { getLanguage } from 'obsidian';
import { en } from './en';
import { ptBR } from './pt-BR';
import type { Catalog, Locale, PluralForms, PluralKey, StringKey } from './types';

const CATALOGS: Record<Locale, Catalog> = {
  en,
  'pt-BR': ptBR,
};

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

export type InterpolationValues = Record<string, string | number>;

/**
 * Resolves Obsidian's language code to a bundled catalog. Portuguese variants use
 * pt-BR; English and every unsupported value (including custom language-file paths)
 * use the English source catalog.
 */
export function resolveLocale(language: string | null | undefined): Locale {
  const normalized = (language ?? '').trim().toLowerCase();
  if (normalized === 'pt' || normalized.startsWith('pt-') || normalized.startsWith('pt_')) {
    return 'pt-BR';
  }
  return 'en';
}

/** Reads the active language at render time; the plugin stores no language preference. */
export function getLocale(): Locale {
  return resolveLocale(getLanguage());
}

/** Single-pass named-placeholder replacement; inserted values are never re-expanded. */
export function interpolate(template: string, values: InterpolationValues = {}): string {
  return template.replace(PLACEHOLDER, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

function lookupString(locale: Locale, key: StringKey): string {
  const translated = CATALOGS[locale].strings[key] as string | undefined;
  if (translated && translated.length > 0) {
    return translated;
  }
  return en.strings[key];
}

function lookupPlural(locale: Locale, key: PluralKey, count: number): string {
  const english = en.plurals[key];
  const translated = CATALOGS[locale].plurals[key] as PluralForms | undefined;
  const selected = count === 1 ? translated?.one : translated?.other;
  const fallback = count === 1 ? english.one : english.other;
  return selected && selected.length > 0 ? selected : fallback;
}

/** Translates a string in the active language, falling back per key to English. */
export function t(key: StringKey, values: InterpolationValues = {}): string {
  return interpolate(lookupString(getLocale(), key), values);
}

/**
 * Translates a countable string. `one` is selected only for exactly 1, so zero and
 * every larger count use the plural form.
 */
export function tp(key: PluralKey, count: number, values: InterpolationValues = {}): string {
  return interpolate(lookupPlural(getLocale(), key, count), { ...values, count });
}
