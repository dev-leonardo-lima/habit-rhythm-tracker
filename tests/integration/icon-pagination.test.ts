import * as obsidian from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { parseHabitNote } from '../../src/storage/habit-note';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

describe('icon pagination', () => {
  it('browses the full registry, retains the page after saving, and resets it on search', async () => {
    const ids = Array.from(
      { length: 82 },
      (_, index) => `custom-icon-${String(index).padStart(3, '0')}`,
    );
    vi.spyOn(obsidian, 'getIconIds').mockReturnValue(ids);
    vi.spyOn(obsidian, 'getIcon').mockImplementation((id) => {
      if (!ids.includes(id)) {
        return null;
      }
      return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    });
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
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
      throw new Error('missing search');
    }
    search.dispatchEvent(new Event('input'));
    expect(picker.querySelectorAll('.habit-tracker-icon-option')).toHaveLength(27);
    expect(picker.querySelector('.habit-tracker-icon-page-label')?.textContent).toBe('Page 1 of 4');
    expect(picker.querySelector('.habit-tracker-icon-hint')?.textContent).toBe(
      'Showing 1–27 of 82 icons.',
    );
    expect(
      picker.querySelector<HTMLButtonElement>('button[aria-label="Previous icon page for Gym"]')
        ?.disabled,
    ).toBe(true);
    picker.querySelector<HTMLButtonElement>('button[aria-label="Next icon page for Gym"]')?.click();
    expect(picker.querySelector('.habit-tracker-icon-page-label')?.textContent).toBe('Page 2 of 4');
    expect(picker.querySelector('.habit-tracker-icon-hint')?.textContent).toBe(
      'Showing 28–54 of 82 icons.',
    );

    const results = picker.querySelector<HTMLElement>('.habit-tracker-icon-results');
    if (!results) {
      throw new Error('missing icon results');
    }
    results.scrollTop = 36;
    results.dispatchEvent(new Event('scroll'));
    const choice = picker.querySelector<HTMLButtonElement>(
      'button[aria-label="Use custom icon 027 icon for Gym"]',
    );
    if (!choice) {
      throw new Error('missing icon on second page');
    }
    choice.focus();
    choice.click();
    await vi.waitFor(() => {
      expect(parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.icon).toBe(
        'custom-icon-027',
      );
    });
    expect(container.querySelector('.habit-tracker-icon-page-label')?.textContent).toBe(
      'Page 2 of 4',
    );
    expect(container.querySelector<HTMLElement>('.habit-tracker-icon-results')?.scrollTop).toBe(36);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Use custom icon 027 icon for Gym',
    );

    container
      .querySelector<HTMLButtonElement>('button[aria-label="Next icon page for Gym"]')
      ?.click();
    expect(container.querySelector<HTMLElement>('.habit-tracker-icon-results')?.scrollTop).toBe(0);
    const lastNext = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next icon page for Gym"]',
    );
    lastNext?.focus();
    lastNext?.click();
    expect(container.querySelector('.habit-tracker-icon-page-label')?.textContent).toBe(
      'Page 4 of 4',
    );
    expect(lastNext?.disabled).toBe(true);
    expect(document.activeElement).toBe(container.querySelector('.habit-tracker-icon-page-label'));
    expect(container.querySelectorAll('.habit-tracker-icon-option')).toHaveLength(1);
    expect(
      container.querySelector('button[aria-label="Use custom icon 081 icon for Gym"]'),
    ).not.toBeNull();

    const freshSearch = container.querySelector<HTMLInputElement>(
      'input[aria-label="Search icons for Gym"]',
    );
    if (!freshSearch) {
      throw new Error('missing restored search');
    }
    freshSearch.value = 'custom icon 0';
    freshSearch.dispatchEvent(new Event('input'));
    expect(container.querySelector('.habit-tracker-icon-page-label')?.textContent).toBe(
      'Page 1 of 4',
    );
    container
      .querySelector<HTMLButtonElement>('button[aria-label="Next icon page for Gym"]')
      ?.click();
    expect(container.querySelector('.habit-tracker-icon-page-label')?.textContent).toBe(
      'Page 2 of 4',
    );
    freshSearch.value = 'custom icon 01';
    freshSearch.dispatchEvent(new Event('input'));
    expect(container.querySelectorAll('.habit-tracker-icon-option')).toHaveLength(10);
    expect(container.querySelector('.habit-tracker-icon-page-label')?.textContent).toBe(
      'Page 1 of 1',
    );
    expect(container.querySelector<HTMLElement>('.habit-tracker-icon-pagination')?.hidden).toBe(
      true,
    );
    freshSearch.value = 'does not exist';
    freshSearch.dispatchEvent(new Event('input'));
    expect(container.querySelector('.habit-tracker-icon-hint')?.textContent).toBe(
      'No icons found. Try another search.',
    );
    expect(container.querySelectorAll('.habit-tracker-icon-option')).toHaveLength(0);

    unsubscribe();
    container.remove();
  });
});
