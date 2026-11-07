import { describe, expect, it, vi } from 'vitest';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { mountDashboard, openHabit, field } from '../helpers/dashboard-view';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

async function setup() {
  const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
  addHabitNote(harness.vault.files, makeHabit());
  const view = await mountDashboard(harness.controller);
  const dialog = openHabit(view);
  const picker = dialog.querySelector<HTMLDetailsElement>('.habit-tracker-icon-picker')!;
  const panel = picker.querySelector<HTMLElement>('[role="dialog"]')!;
  const trigger = picker.querySelector<HTMLElement>('summary')!;
  trigger.click();
  await vi.waitFor(() => expect(panel.hidden).toBe(false));
  return { ...harness, view, dialog, picker, panel, trigger };
}

describe('floating icon chooser', () => {
  it('keeps a mouse choice available when pressing it blurs search without focusing the button', async () => {
    const { dialog, panel, picker, controller, vault } = await setup();
    const search = panel.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(panel.classList.contains('is-fallback')).toBe(true);
    expect(panel.hasAttribute('popover')).toBe(false);
    const choice = panel.querySelector<HTMLButtonElement>('[aria-label="Use heart icon for Gym"]')!;
    const glyph = choice.querySelector<HTMLElement>('.habit-tracker-habit-icon')!;
    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = 'Unsaved name';
    name.dispatchEvent(new Event('input'));

    glyph.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    glyph.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    search.blur();
    await Promise.resolve();
    // Native mouse presses can leave focus on body until after the click finishes.
    expect(panel.hidden).toBe(false);
    glyph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    glyph.click();

    await vi.waitFor(() => expect(controller.getHabitDetail('habit-1', 2026)?.icon).toBe('heart'));
    expect(vault.processCount).toBe(1);
    expect(picker.open).toBe(false);
    expect(panel.hidden).toBe(true);
    expect(name.value).toBe('Unsaved name');
  });

  it('closes only the chooser on Escape and returns focus before closing the habit', async () => {
    const { dialog, picker, panel, trigger, vault } = await setup();
    const original = vault.files.get('Habits/Gym.md');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(document.activeElement).toBe(panel.querySelector('input[type="search"]'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(picker.open).toBe(false);
    expect(panel.hidden).toBe(true);
    expect(dialog.isConnected).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(vault.files.get('Habits/Gym.md')).toBe(original);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog.isConnected).toBe(false);
  });

  it('dismisses on outside input or close without disturbing a draft and tears down with the habit', async () => {
    const { dialog, view, panel, trigger, vault, controller } = await setup();
    const original = vault.files.get('Habits/Gym.md');
    const name = field<HTMLInputElement>(dialog, 'name');
    name.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    name.focus();
    name.value = 'Unsaved';
    name.dispatchEvent(new Event('input'));
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(name);
    trigger.focus();
    trigger.click();
    await vi.waitFor(() => expect(panel.hidden).toBe(false));
    name.focus();
    await vi.waitFor(() => expect(panel.hidden).toBe(true));
    trigger.click();
    await vi.waitFor(() => expect(panel.hidden).toBe(false));
    panel.querySelector<HTMLButtonElement>('.habit-tracker-icon-popover-close')!.click();
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await vi.waitFor(() => expect(panel.hidden).toBe(false));
    await controller.refresh();
    expect(panel.hidden).toBe(false);
    expect(field(dialog, 'name')).toBe(name);
    expect(name.value).toBe('Unsaved');
    await view.onClose();
    expect(panel.hidden).toBe(true);
    expect(dialog.isConnected).toBe(false);
    expect(vault.files.get('Habits/Gym.md')).toBe(original);
  });
});
