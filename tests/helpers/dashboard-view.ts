import { afterEach } from 'vitest';
import type { DashboardController } from '../../src/ui/dashboard-controller';
import { HabitDashboardView } from '../../src/ui/dashboard-view';
import { createFakeApp } from './fake-obsidian-app';

const views = new Set<HabitDashboardView>();
afterEach(async () => {
  for (const view of views) {
    await view.onClose();
  }
  views.clear();
  document.body.replaceChildren();
});

export async function mountDashboard(
  controller: DashboardController,
  provider = () => controller,
): Promise<HabitDashboardView> {
  const { workspace } = createFakeApp();
  const view = new HabitDashboardView(workspace.addLeaf(), provider);
  views.add(view);
  document.body.append(view.contentEl);
  await view.onOpen();
  return view;
}

export function openHabit(view: HabitDashboardView, habitId = 'habit-1'): HTMLElement {
  const trigger = [
    ...view.contentEl.querySelectorAll<HTMLButtonElement>('[data-open-habit-id]'),
  ].find((button) => button.dataset.openHabitId === habitId);
  if (!trigger) {
    throw new Error('Missing habit entry: ' + habitId);
  }
  trigger.click();
  const dialog = [...document.querySelectorAll<HTMLElement>('.habit-tracker-detail-modal')].pop();
  if (!dialog) {
    throw new Error('Missing details dialog');
  }
  return dialog;
}

export function field<T extends HTMLInputElement | HTMLSelectElement>(
  dialog: HTMLElement,
  key: string,
): T {
  const element = dialog.querySelector<T>('[data-field-key="' + key + '"]');
  if (!element) {
    throw new Error('Missing field: ' + key);
  }
  return element;
}

export function submitField(dialog: HTMLElement, key: string): void {
  field(dialog, key)
    .closest('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
