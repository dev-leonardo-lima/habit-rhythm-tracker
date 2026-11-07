import { describe, expect, it } from 'vitest';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { mountDashboard, openHabit, field } from '../helpers/dashboard-view';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

async function setup() {
  const h = createHarness({ now: () => localNoon(2026, 10, 28) });
  addHabitNote(h.vault.files, makeHabit());
  const view = await mountDashboard(h.controller);
  return { ...h, view, dialog: openHabit(view) };
}

function information(dialog: HTMLElement, label: string) {
  const button = dialog.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const panel = dialog.querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`)!;
  return { button, panel };
}

describe('optional editor information', () => {
  it('opens timing guidance without submitting a target and consumes Escape before the dialog', async () => {
    const { dialog, controller, vault } = await setup();
    const original = vault.files.get('Habits/Gym.md');
    const target = field<HTMLSelectElement>(dialog, 'target');
    target.value = '3';
    target.dispatchEvent(new Event('change'));
    const { button, panel } = information(dialog, 'About the weekly target');
    expect(panel.hidden).toBe(true);
    expect(
      dialog.querySelector<HTMLElement>(`#${target.getAttribute('aria-describedby')}`)?.hidden,
    ).toBe(true);
    button.click();
    expect(button.type).toBe('button');
    expect(button.closest('label')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toBe('Applies from next Monday.');
    expect(controller.getHabitDetail('habit-1', 2026)?.pendingTarget).toBeNull();
    expect(vault.files.get('Habits/Gym.md')).toBe(original);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.hidden).toBe(true);
    expect(dialog.isConnected).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(target.value).toBe('3');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog.isConnected).toBe(false);
  });

  it('keeps one explanation open, dismisses outside, and disposes it with the editor', async () => {
    const { dialog, vault, view } = await setup();
    const original = vault.files.get('Habits/Gym.md');
    const appearance = information(dialog, 'About appearance');
    const archiveButton = dialog.querySelector<HTMLButtonElement>('[data-action="archive-state"]')!;
    const archivePanel = dialog.querySelector<HTMLElement>(
      `#${archiveButton.getAttribute('aria-describedby')}`,
    )!;
    appearance.button.click();
    expect(appearance.panel.hidden).toBe(false);
    archiveButton.dispatchEvent(new Event('mouseenter'));
    expect(appearance.panel.hidden).toBe(true);
    expect(archivePanel.hidden).toBe(false);
    field(dialog, 'name').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(archivePanel.hidden).toBe(true);
    archiveButton.focus();
    expect(archivePanel.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(archivePanel.hidden).toBe(true);
    expect(dialog.isConnected).toBe(true);
    appearance.button.click();
    await view.onClose();
    expect(appearance.panel.hidden).toBe(true);
    expect(vault.files.get('Habits/Gym.md')).toBe(original);
  });
});
