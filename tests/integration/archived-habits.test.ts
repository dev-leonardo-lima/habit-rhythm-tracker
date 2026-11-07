import { describe, expect, it, vi } from 'vitest';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';
import { mountDashboard, openHabit } from '../helpers/dashboard-view';

const archived = (id = 'archived', name = 'Read') =>
  makeHabit({
    id,
    name,
    created: '2026-10-05',
    states: [
      { week: '2026-10-05', state: 'active' },
      { week: '2026-10-19', state: 'archived' },
    ],
    completions: ['2026-10-06'],
  });

describe('archived habit access', () => {
  it('finds archived habits absent from the grid, independent of viewed week, and reactivates without navigation', async () => {
    const { controller, vault } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, { ...archived(), color: '#3366cc', icon: 'book-open' });
    const view = await mountDashboard(controller);
    expect(
      view.contentEl.querySelector('.habit-tracker-grid [data-open-habit-id="archived"]'),
    ).toBeNull();
    expect(
      view.contentEl.querySelector('[data-disclosure-key="archived"] > summary')?.textContent,
    ).toBe('Archived (1)');
    controller.previousWeek();
    controller.previousWeek();
    const selected = controller.getViewModel().focusedWeek;
    const list = view.contentEl.querySelector<HTMLDetailsElement>(
      '[data-disclosure-key="archived"]',
    )!;
    list.open = true;
    expect(list.querySelector('summary')?.textContent).toBe('Archived (1)');
    expect(
      list
        .querySelector<HTMLButtonElement>('[data-open-habit-id]')
        ?.style.getPropertyValue('--ht-habit-color'),
    ).toBe('#3366cc');
    expect(list.querySelector('.habit-tracker-habit-icon')).not.toBeNull();
    list.querySelector<HTMLButtonElement>('[data-open-habit-id]')!.click();
    const dialog = document.querySelector<HTMLElement>('.habit-tracker-detail-modal')!;

    expect(dialog.textContent).toContain('1 day');
    dialog.querySelector<HTMLButtonElement>('[aria-label="Reactivate Read this week"]')!.click();
    await vi.waitFor(() =>
      expect(controller.getHabitDetail('archived', 2026)?.state).toBe('active'),
    );
    expect(controller.getViewModel().focusedWeek).toBe(selected);
    expect(view.contentEl.querySelector('[data-disclosure-key="archived"]')).toBeNull();
    expect(controller.getHabitDetail('archived', 2026)?.history.markedDays).toBe(1);
  });

  it('counts pending archives only at rollover and keeps quick creation after deleting the final archived habit', async () => {
    let now = localNoon(2026, 10, 28);
    const { controller, vault } = createHarness({ now: () => now });
    addHabitNote(
      vault.files,
      makeHabit({
        id: 'pending',
        states: [
          { week: '2026-10-26', state: 'active' },
          { week: '2026-11-02', state: 'archived' },
        ],
      }),
    );
    const view = await mountDashboard(controller);
    expect(view.contentEl.querySelector('[data-disclosure-key="archived"]')).toBeNull();
    now = localNoon(2026, 11, 2);
    await controller.refreshClock();
    const list = view.contentEl.querySelector<HTMLDetailsElement>(
      '[data-disclosure-key="archived"]',
    )!;
    expect(list.querySelector('summary')?.textContent).toBe('Archived (1)');
    list.open = true;
    const dialog = openHabit(view, 'pending');

    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
    );
    dialog.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
    await vi.waitFor(() => expect(controller.getViewModel().habits).toHaveLength(0));
    expect(view.contentEl.querySelector('[data-disclosure-key="archived"]')).toBeNull();
    expect(view.contentEl.querySelector('form[data-form-key="create"]')).not.toBeNull();
    expect(document.activeElement).toBe(
      view.contentEl.querySelector('form[data-form-key="create"] input'),
    );
  });

  it('disambiguates active and hidden archived twins and deletes only the selected note', async () => {
    const { controller, vault } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'active', name: 'Read' }), 'Habits/A.md');
    addHabitNote(vault.files, archived('archived', 'READ'), 'Habits/B.md');
    const original = vault.files.get('Habits/A.md');
    const view = await mountDashboard(controller);
    const active = view.contentEl.querySelector<HTMLButtonElement>(
      '.habit-tracker-grid [data-open-habit-id="active"]',
    )!;
    expect(active.getAttribute('aria-label')).toContain('Habits/A.md');
    expect(active.closest('th')?.querySelector('.habit-tracker-habit-path')?.textContent).toBe(
      'Habits/A.md',
    );
    const list = view.contentEl.querySelector<HTMLDetailsElement>(
      '[data-disclosure-key="archived"]',
    )!;
    list.open = true;
    expect(list.querySelector('[data-open-habit-id="archived"]')?.textContent).toContain(
      'Habits/B.md',
    );
    const dialog = openHabit(view, 'archived');

    expect(dialog.querySelector('.habit-tracker-detail-path')?.textContent).toBe('Habits/B.md');
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
    );
    dialog.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
    await vi.waitFor(() => expect(vault.files.has('Habits/B.md')).toBe(false));
    expect(vault.files.get('Habits/A.md')).toBe(original);
    await vi.waitFor(() =>
      expect(view.contentEl.querySelector('[data-open-habit-id="active"]')?.textContent).toBe(
        'Read',
      ),
    );
  });

  it('keeps invalid and duplicate IDs in note issues instead of inflating the archive count', async () => {
    const { controller, vault } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, archived('same', 'A'), 'Habits/A.md');
    addHabitNote(vault.files, archived('same', 'B'), 'Habits/B.md');
    vault.files.set('Habits/Invalid.md', 'user text only');
    const original = [...vault.files];
    const view = await mountDashboard(controller);
    expect(view.contentEl.querySelector('[data-disclosure-key="archived"]')).toBeNull();
    expect(controller.getViewModel().issues.length).toBeGreaterThan(0);
    expect([...vault.files]).toEqual(original);
  });
});
