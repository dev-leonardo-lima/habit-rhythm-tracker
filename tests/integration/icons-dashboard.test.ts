import { describe, expect, it, vi } from 'vitest';
import { parseHabitNote, renderHabitNote, replaceHabitBlock } from '../../src/storage/habit-note';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

describe('icons and weekly progress', () => {
  it('searches, saves and removes an icon while preserving the open editor and note content', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    const original = makeHabit({ name: 'Gym', color: '#3366cc', completions: ['2026-10-27'] });
    harness.vault.files.set(
      'Habits/Gym.md',
      `Personal notes\n\n${renderHabitNote(original)}\nKeep me\n`,
    );
    await harness.controller.load();
    const container = document.createElement('div');
    document.body.append(container);
    const handlers = createDashboardHandlers(harness.controller);
    const render = () => renderDashboard(container, harness.controller.getViewModel(), handlers);
    const unsubscribe = harness.controller.subscribe(render);
    render();

    const manage = container.querySelector<HTMLDetailsElement>('[data-disclosure-key="manage"]');
    const edit = container.querySelector<HTMLDetailsElement>(
      '[data-disclosure-key="edit:habit-1"]',
    );
    const picker = container.querySelector<HTMLDetailsElement>(
      '[data-disclosure-key="icon:habit-1"]',
    );
    if (!manage || !edit || !picker) {
      throw new Error('missing icon controls');
    }
    manage.open = true;
    edit.open = true;
    picker.open = true;
    const search = picker.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) {
      throw new Error('missing icon search');
    }
    search.value = 'book open';
    search.dispatchEvent(new Event('input'));
    expect(picker.querySelectorAll('.habit-tracker-icon-option')).toHaveLength(1);
    const choice = picker.querySelector<HTMLButtonElement>(
      'button[aria-label="Use book open icon for Gym"]',
    );
    if (!choice) {
      throw new Error('missing icon choice');
    }
    choice.focus();
    choice.click();
    await vi.waitFor(() => {
      expect(parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.icon).toBe(
        'book-open',
      );
    });
    const note = harness.vault.files.get('Habits/Gym.md') ?? '';
    expect(note).toContain('Personal notes');
    expect(note).toContain('Keep me');
    expect(parseHabitNote(note).habit).toMatchObject({
      color: '#3366cc',
      completions: ['2026-10-27'],
    });
    expect(
      container
        .querySelector('[data-history-habit-id="habit-1"] svg')
        ?.getAttribute('data-icon-id'),
    ).toBe('book-open');
    expect(
      container.querySelector<HTMLDetailsElement>('[data-disclosure-key="icon:habit-1"]')?.open,
    ).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Search icons for Gym"]')?.value,
    ).toBe('book open');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Use book open icon for Gym');

    const remove = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove icon for Gym"]',
    );
    remove?.focus();
    remove?.click();
    await vi.waitFor(() => {
      expect(
        parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.icon,
      ).toBeUndefined();
    });
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-10-27']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Choose icon for Gym');

    unsubscribe();
    container.remove();
  });

  it('retains an unavailable icon through unrelated edits and shows it as unavailable', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(
      harness.vault.files,
      makeHabit({ name: 'Gym', icon: 'plugin-icon-on-another-device' }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    await harness.controller.toggleCompletion('habit-1', '2026-10-28', true);
    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.icon).toBe('plugin-icon-on-another-device');
    expect(note.completions).toContain('2026-10-28');
    const container = document.createElement('div');
    renderDashboard(
      container,
      harness.controller.getViewModel(),
      createDashboardHandlers(harness.controller),
    );
    expect(container.textContent).toContain('Icon: plugin icon on another device (unavailable)');
  });

  it('does not overwrite a concurrent note edit while saving an icon', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    harness.vault.beforeProcess = (path) => {
      if (path !== 'Habits/Gym.md') {
        return;
      }
      harness.vault.beforeProcess = null;
      const content = harness.vault.files.get(path) ?? '';
      const habit = parseHabitNote(content).habit;
      harness.vault.files.set(
        path,
        replaceHabitBlock(content, { ...habit, completions: ['2026-10-27'] }),
      );
    };
    expect((await harness.controller.changeIcon('habit-1', 'dumbbell'))?.status).toBe('conflict');
    const afterConflict = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(afterConflict.icon).toBeUndefined();
    expect(afterConflict.completions).toEqual(['2026-10-27']);
    expect((await harness.controller.changeIcon('habit-1', 'dumbbell'))?.status).toBe('applied');
    const retried = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(retried).toMatchObject({ icon: 'dumbbell', completions: ['2026-10-27'] });
  });

  it('shows individual progress without an aggregate summary and excludes future marks', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(
      harness.vault.files,
      makeHabit({ name: 'Gym', targets: [{ week: '2026-10-26', days: 4 }] }),
      'Habits/Gym.md',
    );
    addHabitNote(
      harness.vault.files,
      makeHabit({
        id: 'habit-2',
        name: 'Read',
        targets: [{ week: '2026-10-26', days: 2 }],
        completions: ['2026-10-26', '2026-10-30'],
      }),
      'Habits/Read.md',
    );
    addHabitNote(
      harness.vault.files,
      makeHabit({
        id: 'habit-3',
        name: 'Archived',
        created: '2026-10-19',
        states: [
          { week: '2026-10-19', state: 'active' },
          { week: '2026-10-26', state: 'archived' },
        ],
        completions: ['2026-10-27'],
      }),
      'Habits/Archived.md',
    );
    await harness.controller.load();
    const container = document.createElement('div');
    const handlers = createDashboardHandlers(harness.controller);
    const render = () => renderDashboard(container, harness.controller.getViewModel(), handlers);
    const unsubscribe = harness.controller.subscribe(render);
    render();
    expect(container.textContent).not.toContain('Weekly goals met');
    expect(container.textContent).not.toContain('Average progress');
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(
      container.querySelector('[data-habit-id="habit-2"] .habit-tracker-habit-status')?.textContent,
    ).toContain('1 / 2');
    await harness.controller.toggleCompletion('habit-2', '2026-10-28', true);
    expect(
      container.querySelector('[data-habit-id="habit-2"] .habit-tracker-habit-status')?.textContent,
    ).toContain('2 / 2 · Successful');
    harness.controller.nextWeek();
    expect(container.textContent).not.toContain('Weekly goals met');
    unsubscribe();
  });
});
