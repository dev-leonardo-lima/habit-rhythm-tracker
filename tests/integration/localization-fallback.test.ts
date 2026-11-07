import { describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { ptBR } from '../../src/i18n/pt-BR';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';
import { mountDashboard, openHabit, field } from '../helpers/dashboard-view';

function languageControl(initial: string) {
  let current = initial;
  vi.spyOn(obsidian, 'getLanguage').mockImplementation(() => current);
  return {
    set: (language: string) => {
      current = language;
    },
  };
}
async function setup() {
  const h = createHarness({ now: () => localNoon(2026, 10, 28) });
  addHabitNote(
    h.vault.files,
    makeHabit({ name: 'Academia', completions: ['2026-10-26', '2026-10-27'] }),
    'Habits/Academia.md',
  );
  return { ...h, view: await mountDashboard(h.controller) };
}

describe('language fallback through habit details', () => {
  it('uses English for unsupported languages and custom locale-file paths', async () => {
    const language = languageControl('fr');
    const { controller, view } = await setup();
    const dialog = openHabit(view);

    expect(view.contentEl.querySelector('.habit-tracker-week-meta')?.textContent).toBe('This week');
    expect(dialog.textContent).toContain('Current streak');
    expect(dialog.textContent).toContain('Weekly target');
    expect(dialog.textContent).toContain('Applies from next Monday.');
    expect(dialog.textContent).toContain('Appearance');
    language.set('/vault/locales/pt-BR.json');
    await controller.refresh();
    expect(dialog.textContent).toContain('Current streak');
    expect(dialog.textContent).not.toContain('Sequência atual');
  });
  it('falls back per missing/empty entry without exposing keys', async () => {
    const language = languageControl('pt-BR');
    const { controller, view } = await setup();
    const strings = ptBR.strings as Record<string, string>;
    const original = strings['dashboard.openHabitAria'];
    try {
      delete strings['dashboard.openHabitAria'];
      await controller.refresh();
      expect(view.contentEl.querySelector('[data-open-habit-id]')?.getAttribute('aria-label')).toBe(
        'Open habit Academia',
      );
      strings['dashboard.openHabitAria'] = '';
      await controller.refresh();
      expect(view.contentEl.querySelector('[data-open-habit-id]')?.getAttribute('aria-label')).toBe(
        'Open habit Academia',
      );
      expect(view.contentEl.textContent).not.toContain('dashboard.openHabitAria');
    } finally {
      strings['dashboard.openHabitAria'] = original!;
    }
    language.set('pt');
    await controller.refresh();
    expect(view.contentEl.querySelector('[data-open-habit-id]')?.getAttribute('aria-label')).toBe(
      'Abrir hábito Academia',
    );
  });
  it('preserves notes, creation and editing drafts, settings, and open history across a language switch', async () => {
    const language = languageControl('pt-BR');
    const { controller, vault, view, habitsFolder } = await setup();
    const original = vault.files.get('Habits/Academia.md');
    const create = view.contentEl.querySelector<HTMLInputElement>(
      'form[data-form-key="create"] input',
    )!;
    create.value = 'Rascunho';
    const target = view.contentEl.querySelector<HTMLSelectElement>(
      'form[data-form-key="create"] select',
    )!;
    target.value = '3';
    const dialog = openHabit(view);

    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = 'Outra ideia';
    expect(dialog.textContent).toContain('Sequência atual');
    language.set('en');
    await controller.refresh();
    expect(dialog.textContent).toContain('Current streak');
    expect(dialog.textContent).toContain('Weekly target');
    expect(dialog.textContent).toContain('Applies from next Monday.');
    expect(dialog.textContent).toContain('Appearance');
    expect(field(dialog, 'name')).toBe(name);
    expect(name.value).toBe('Outra ideia');
    expect(
      view.contentEl.querySelector<HTMLInputElement>('form[data-form-key="create"] input')?.value,
    ).toBe('Rascunho');
    expect(
      view.contentEl.querySelector<HTMLSelectElement>('form[data-form-key="create"] select')?.value,
    ).toBe('3');
    expect(
      dialog.querySelector<HTMLElement>('[data-testid="habit-history"]')?.dataset.habitId,
    ).toBe('habit-1');
    expect(habitsFolder).toBe('Habits');
    expect(vault.files.get('Habits/Academia.md')).toBe(original);
    language.set('pt-BR');
    await controller.refresh();
    expect(dialog.textContent).toContain('Sequência atual');
    expect(name.value).toBe('Outra ideia');
  });
  it('keeps English data and date behavior', async () => {
    languageControl('en-GB');
    const { view, vault } = await setup();
    expect(
      view.contentEl.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label'),
    ).toBe('26 Oct – 1 Nov 2026');
    expect(view.contentEl.textContent).toContain('Streak: 0 weeks');
    expect(view.contentEl.querySelector('[data-open-habit-id]')?.getAttribute('aria-label')).toBe(
      'Open habit Academia',
    );
    expect(vault.files.get('Habits/Academia.md')).toContain('"completions"');
  });
});
