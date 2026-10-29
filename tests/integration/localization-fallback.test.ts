import { describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { ptBR } from '../../src/i18n/pt-BR';
import { parseHabitNote } from '../../src/storage/habit-note';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

function languageControl(initial: string): {
  set(language: string): void;
} {
  let current = initial;
  vi.spyOn(obsidian, 'getLanguage').mockImplementation(() => current);
  return {
    set(language: string) {
      current = language;
    },
  };
}

function setup(now: () => Date) {
  const harness = createHarness({ now });
  const container = document.createElement('div');
  document.body.append(container);
  const handlers = createDashboardHandlers(harness.controller);
  const render = () => renderDashboard(container, harness.controller.getViewModel(), handlers);
  const unsubscribe = harness.controller.subscribe(render);
  return { harness, container, render, unsubscribe };
}

describe('US3: unsupported and incomplete languages fall back cleanly', () => {
  it('shows English for an unsupported language and a custom language-file path', async () => {
    const language = languageControl('fr');
    const { harness, container, render } = setup(() => localNoon(2026, 10, 28));
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    render();

    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('This week');
    expect(container.textContent).toContain('Manage habits');
    expect(container.textContent).toContain('View history');
    expect(container.textContent).not.toContain('Esta semana');
    expect(container.textContent).not.toContain('Gerenciar hábitos');

    language.set('/vault/locales/pt-BR.json');
    await harness.controller.refresh();
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('This week');
    expect(container.textContent).toContain('Manage habits');
    expect(container.textContent).not.toContain('Gerenciar hábitos');
  });

  it('falls back to a whole English entry when a Portuguese entry is missing or empty', async () => {
    const language = languageControl('pt-BR');
    const { harness, container, render } = setup(() => localNoon(2026, 10, 28));
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    render();
    expect(container.textContent).toContain('Gerenciar hábitos');

    const strings = ptBR.strings as Record<string, string>;
    const originalManage = strings['dashboard.manageHabits'];
    delete strings['dashboard.manageHabits'];
    await harness.controller.refresh();
    expect(container.textContent).toContain('Manage habits');
    expect(container.textContent).not.toContain('Gerenciar hábitos');
    expect(container.textContent).not.toContain('dashboard.manageHabits');
    strings['dashboard.manageHabits'] = originalManage ?? 'Gerenciar hábitos';

    const originalTarget = strings['manage.columnTarget'];
    strings['manage.columnTarget'] = '';
    await harness.controller.refresh();
    expect(container.textContent).toContain('Target');
    expect(container.textContent).not.toContain('manage.columnTarget');
    strings['manage.columnTarget'] = originalTarget ?? 'Meta semanal';

    language.set('pt');
    await harness.controller.refresh();
    expect(container.textContent).toContain('Meta semanal');
  });

  it('preserves habits, marks, settings, drafts, the open view and note content across a switch', async () => {
    const language = languageControl('pt-BR');
    const { harness, container, render, unsubscribe } = setup(() => localNoon(2026, 10, 28));
    const path = 'Habits/Academia.md';
    addHabitNote(
      harness.vault.files,
      makeHabit({
        name: 'Academia',
        targets: [{ week: '2026-10-26', days: 4 }],
        completions: ['2026-10-26', '2026-10-27'],
      }),
      path,
    );
    await harness.controller.load();
    render();
    const originalNote = harness.vault.files.get(path);
    const originalCompletions = parseHabitNote(originalNote ?? '').habit.completions;
    const habitsFolder = harness.habitsFolder;

    const name = container.querySelector<HTMLInputElement>('form[data-form-key="create"] input');
    const target = container.querySelector<HTMLSelectElement>(
      'form[data-form-key="create"] select',
    );
    if (!name || !target) {
      throw new Error('missing create form');
    }
    name.value = 'Rascunho em português';
    target.value = '3';
    container
      .querySelector<HTMLButtonElement>('button[aria-label="Ver histórico de Academia"]')
      ?.click();
    expect(
      container.querySelector<HTMLElement>('[data-testid="habit-history"]')?.dataset.habitId,
    ).toBe('habit-1');
    expect(container.textContent).toContain('Sequência atual');

    language.set('en');
    await harness.controller.refresh();
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('This week');
    expect(container.textContent).toContain('Manage habits');
    expect(container.textContent).toContain('Current streak');
    expect(container.textContent).not.toContain('Esta semana');
    expect(
      container.querySelector<HTMLInputElement>('form[data-form-key="create"] input')?.value,
    ).toBe('Rascunho em português');
    expect(
      container.querySelector<HTMLSelectElement>('form[data-form-key="create"] select')?.value,
    ).toBe('3');
    expect(
      container.querySelector<HTMLElement>('[data-testid="habit-history"]')?.dataset.habitId,
    ).toBe('habit-1');
    expect(container.textContent).toContain('Academia');
    expect(harness.vault.files.get(path)).toBe(originalNote);
    expect(parseHabitNote(harness.vault.files.get(path) ?? '').habit.completions).toEqual(
      originalCompletions,
    );
    expect(harness.habitsFolder).toBe(habitsFolder);

    language.set('pt-BR');
    await harness.controller.refresh();
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('Esta semana');
    expect(container.textContent).toContain('Gerenciar hábitos');
    expect(
      container.querySelector<HTMLInputElement>('form[data-form-key="create"] input')?.value,
    ).toBe('Rascunho em português');
    expect(harness.vault.files.get(path)).toBe(originalNote);

    unsubscribe();
    container.remove();
  });

  it('keeps English behavior and data for an English installation', async () => {
    const language = languageControl('en-GB');
    const { harness, container, render } = setup(() => localNoon(2026, 10, 28));
    addHabitNote(
      harness.vault.files,
      makeHabit({ name: 'Gym', completions: ['2026-10-26'] }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    render();
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '26 Oct – 1 Nov 2026',
    );
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('This week');
    expect(container.textContent).toContain('Streak: 0 weeks');
    expect(container.textContent).toContain('Manage habits');
    expect(container.textContent).not.toContain('Esta semana');
    language.set('en');
    expect(harness.vault.files.get('Habits/Gym.md')).toContain('"completions"');
  });
});
