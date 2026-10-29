import { describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import {
  normalizeHabitName,
  setCompletion,
  setHabitColor,
} from '../../src/domain/habit-operations';
import { parseHabitNote } from '../../src/storage/habit-note';
import { validateFolder } from '../../src/settings';
import { en } from '../../src/i18n/en';
import { ptBR } from '../../src/i18n/pt-BR';
import {
  getLocale,
  interpolate,
  resolveLocale,
  t,
  tp,
  type InterpolationValues,
} from '../../src/i18n';
import {
  fullDate,
  monthLabel,
  monthShort,
  shortDate,
  weekLabel,
  weekRangeLabel,
  weekYearsLabel,
  weekdayName,
  weekdayShort,
} from '../../src/ui/text';
import { makeHabit } from '../helpers/fixtures';

function useLanguage(language: string): void {
  vi.spyOn(obsidian, 'getLanguage').mockReturnValue(language);
}

function localized<T>(language: string, action: () => T): T {
  useLanguage(language);
  return action();
}

describe('locale resolution', () => {
  it('maps English, Portuguese variants, unsupported languages and custom paths', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('en-GB')).toBe('en');
    expect(resolveLocale('EN')).toBe('en');
    expect(resolveLocale('pt')).toBe('pt-BR');
    expect(resolveLocale('pt-BR')).toBe('pt-BR');
    expect(resolveLocale('pt-PT')).toBe('pt-BR');
    expect(resolveLocale('PT-BR')).toBe('pt-BR');
    expect(resolveLocale('pt_BR')).toBe('pt-BR');
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale('/vault/locales/de.json')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('reads the active language from Obsidian on every call', () => {
    useLanguage('en-GB');
    expect(getLocale()).toBe('en');
    useLanguage('pt');
    expect(getLocale()).toBe('pt-BR');
    useLanguage('fr');
    expect(getLocale()).toBe('en');
  });
});

describe('catalog contract', () => {
  it('has the same keys as the English source catalog and no blank entries', () => {
    expect(Object.keys(ptBR.strings).sort()).toEqual(Object.keys(en.strings).sort());
    expect(Object.keys(ptBR.plurals).sort()).toEqual(Object.keys(en.plurals).sort());
    for (const [key, value] of Object.entries(ptBR.strings)) {
      expect(value.trim(), key).not.toBe('');
    }
    for (const [key, forms] of Object.entries(ptBR.plurals)) {
      expect(forms.one.trim(), key).not.toBe('');
      expect(forms.other.trim(), key).not.toBe('');
    }
  });

  it('uses the confirmed glossary consistently', () => {
    expect(ptBR.strings['form.name']).toContain('hábito');
    expect(ptBR.strings['history.title']).toContain('Histórico');
    expect(ptBR.strings['action.archive']).toContain('Arquivar');
    expect(ptBR.strings['manage.columnTarget']).toBe('Meta semanal');
    expect(ptBR.strings['manage.summaryAria']).toContain('progresso');
    expect(ptBR.plurals['dashboard.streak'].other).toContain('Sequência');
    expect(ptBR.strings['history.hint']).toContain('sequências');
  });
});

describe('translation lookup and interpolation', () => {
  it('translates through the active catalog and falls back per missing key', () => {
    useLanguage('pt-BR');
    expect(t('action.close')).toBe('Fechar');
    expect(t('dashboard.viewHistoryAria', { name: 'Academia' })).toBe('Ver histórico de Academia');

    const close = ptBR.strings['action.close'];
    delete (ptBR.strings as Partial<Record<keyof typeof en.strings, string>>)['action.close'];
    expect(t('action.close')).toBe('Close');
    (ptBR.strings as Record<string, string>)['action.close'] = close;

    const next = ptBR.strings['action.next'];
    (ptBR.strings as Record<string, string>)['action.next'] = '';
    expect(t('action.next')).toBe('Next');
    (ptBR.strings as Record<string, string>)['action.next'] = next;

    useLanguage('fr');
    expect(t('action.close')).toBe('Close');
  });

  it('replaces placeholders in a single pass', () => {
    const values: InterpolationValues = { name: '{count}', count: 3 };
    expect(interpolate('{name} has {count}', values)).toBe('{count} has 3');
    expect(interpolate('{missing}', values)).toBe('{missing}');
  });

  it('selects plural forms by exact count, including zero', () => {
    expect(localized('en', () => tp('unit.week', 0))).toBe('0 weeks');
    expect(localized('en', () => tp('unit.week', 1))).toBe('1 week');
    expect(localized('en', () => tp('unit.week', 2))).toBe('2 weeks');

    expect(localized('pt-BR', () => tp('unit.week', 0))).toBe('0 semanas');
    expect(localized('pt-BR', () => tp('unit.week', 1))).toBe('1 semana');
    expect(localized('pt-BR', () => tp('unit.week', 2))).toBe('2 semanas');

    expect(localized('pt-BR', () => tp('unit.day', 0))).toBe('0 dias');
    expect(localized('pt-BR', () => tp('unit.day', 1))).toBe('1 dia');
    expect(localized('pt-BR', () => tp('form.targetOption', 1))).toBe('1 dia / semana');
    expect(localized('pt-BR', () => tp('form.targetOption', 4))).toBe('4 dias / semana');
    expect(localized('pt-BR', () => tp('dashboard.streak', 0))).toBe('Sequência: 0 semanas');
    expect(localized('pt-BR', () => tp('manage.pendingTarget', 1))).toBe(
      'Meta semanal de 1 dia agendada para a próxima semana.',
    );
    expect(localized('pt-BR', () => tp('manage.pendingTarget', 4))).toBe(
      'Meta semanal de 4 dias agendada para a próxima semana.',
    );
  });
});

describe('locale-aware date labels', () => {
  it('formats English dates exactly as before', () => {
    useLanguage('en');
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('bad')).toBe('bad');
    expect(monthShort('2026-10')).toBe('Oct');
    expect(monthShort('bad')).toBe('');
    expect(weekdayName(0)).toBe('Monday');
    expect(weekdayName(7)).toBe('');
    expect(weekdayShort(6)).toBe('Sun');
    expect(shortDate('2026-10-26')).toBe('26 Oct');
    expect(fullDate('2026-10-26')).toBe('October 26, 2026');
    expect(weekRangeLabel('2026-10-26')).toBe('26 Oct – 1 Nov');
    expect(weekYearsLabel('2026-12-28')).toBe('2026 – 2027');
    expect(weekLabel('2026-10-26')).toBe('26 Oct – 1 Nov 2026');
    expect(weekLabel('2026-12-28')).toBe('28 Dec 2026 – 3 Jan 2027');
  });

  it('formats Brazilian Portuguese dates with local names', () => {
    useLanguage('pt-BR');
    expect(monthLabel('2026-10')).toBe('outubro de 2026');
    expect(monthShort('2026-10')).toBe('out');
    expect(weekdayName(0)).toBe('segunda-feira');
    expect(weekdayShort(6)).toBe('dom');
    expect(shortDate('2026-10-26')).toBe('26 out');
    expect(fullDate('2026-10-26')).toBe('26 de outubro de 2026');
    expect(weekRangeLabel('2026-10-26')).toBe('26 out – 1 nov');
    expect(weekYearsLabel('2026-12-28')).toBe('2026 – 2027');
    expect(weekLabel('2026-10-26')).toBe('26 out – 1 nov 2026');
    expect(weekLabel('2026-12-28')).toBe('28 dez 2026 – 3 jan 2027');
    expect(monthLabel('2026-01')).toBe('janeiro de 2026');
  });
});

describe('localized shared errors', () => {
  it('localizes domain, settings and storage messages', () => {
    localized('pt-BR', () => {
      expect(() => normalizeHabitName(' ')).toThrow('Informe um nome de hábito');
      expect(() => setHabitColor(makeHabit(), 'red')).toThrow(
        'Escolha uma cor hexadecimal de seis dígitos válida',
      );
      const habit = makeHabit();
      expect(() => setCompletion(habit, '2026-10-25', true, '2026-10-28')).toThrow(
        'A data é anterior à criação do hábito',
      );
      expect(() => setCompletion(habit, '2026-10-29', true, '2026-10-28')).toThrow(
        'Datas futuras não podem ser alteradas',
      );
      expect(() => validateFolder('')).toThrow('Informe um nome de pasta do cofre');
      expect(() => parseHabitNote('# no markers')).toThrow(
        'Os marcadores da nota de hábito estão ausentes',
      );
    });

    localized('en', () => {
      expect(() => normalizeHabitName(' ')).toThrow('Enter a habit name');
      expect(() => validateFolder('')).toThrow('Enter a vault folder name');
      expect(() => parseHabitNote('# no markers')).toThrow('Habit note markers are missing');
    });

    useLanguage('fr');
    expect(() => normalizeHabitName(' ')).toThrow('Enter a habit name');
  });
});
