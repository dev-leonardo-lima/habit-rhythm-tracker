import type { enPlurals, enStrings } from './en';

/** A catalog identifier. English is the source and fallback; pt-BR is the translation. */
export type Locale = 'en' | 'pt-BR';

/** Every message key is derived from the English source catalog. */
export type StringKey = keyof typeof enStrings;

/** Every countable message key is derived from the English source catalog. */
export type PluralKey = keyof typeof enPlurals;

export interface PluralForms {
  one: string;
  other: string;
}

export interface Catalog {
  strings: Record<StringKey, string>;
  plurals: Record<PluralKey, PluralForms>;
}
