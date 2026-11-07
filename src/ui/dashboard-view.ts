import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { t } from '../i18n';
import type { DashboardController, DashboardMessage } from './dashboard-controller';
import { createDashboardHandlers } from './controller-handlers';
import { renderDashboard } from './dashboard-renderer';
import { HabitDetailModal } from './habit-detail-modal';
import type { HabitDraft } from './habit-editor';
import type { WriteResult } from '../storage/guarded-write';

export const VIEW_TYPE_HABIT_DASHBOARD = 'habit-rhythm-tracker-dashboard';
export type ControllerProvider = () => DashboardController;

export class HabitDashboardView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private active = false;
  private rendering = false;
  private modal: HabitDetailModal | null = null;
  private readonly drafts = new Map<string, HabitDraft>();
  private unavailableMessage: {
    habitId: string;
    formResetVersion: number;
    message: DashboardMessage;
  } | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly provider: ControllerProvider,
  ) {
    super(leaf);
  }
  override getViewType(): string {
    return VIEW_TYPE_HABIT_DASHBOARD;
  }
  override getDisplayText(): string {
    return t('view.dashboard.title');
  }
  override getIcon(): string {
    return 'check-square';
  }
  private get controller(): DashboardController {
    return this.provider();
  }

  override async onOpen(): Promise<void> {
    this.active = true;
    this.unavailableMessage = null;
    this.contentEl.addClass('habit-tracker-view');
    this.subscribe();
    await this.controller.refreshClock();
    await this.controller.refresh();
  }
  override async onClose(): Promise<void> {
    this.active = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.modal?.close();
    this.modal = null;
    this.drafts.clear();
  }
  rebind(): void {
    this.modal?.close();
    this.modal = null;
    this.drafts.clear();
    this.unavailableMessage = null;
    this.subscribe();
  }
  private subscribe(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.controller.subscribe(() => this.render());
    this.render();
  }
  private render(): void {
    if (!this.active || this.rendering) {
      return;
    }
    this.rendering = true;
    try {
      const controller = this.controller;
      const model = controller.getViewModel();
      const modal = this.modal;
      if (
        this.unavailableMessage &&
        (model.message ||
          model.formResetVersion !== this.unavailableMessage.formResetVersion ||
          model.habits.some((habit) => habit.habitId === this.unavailableMessage?.habitId))
      ) {
        this.unavailableMessage = null;
      }
      if (model.settingsChanging) {
        if (modal) {
          this.rememberDraft(modal.habitId, modal.getDraft());
        }
        modal?.close();
        this.modal = null;
      } else if (modal) {
        if (modal.controller !== controller) {
          this.drafts.clear();
          modal.close();
          this.modal = null;
        } else {
          const detail = controller.getHabitDetail(modal.habitId, Number(model.today.slice(0, 4)));
          if (detail) {
            // The dialog retains its selected year; updates project that year internally.
            modal.updateFromController(model, model.duplicateHabitIds.has(detail.habitId));
          } else if (!model.loading && !modal.deletionInFlight) {
            this.drafts.delete(modal.habitId);
            this.unavailableMessage = {
              habitId: modal.habitId,
              formResetVersion: model.formResetVersion,
              message: {
                kind: 'warning',
                text: t('details.unavailable', { name: modal.habitName }),
              },
            };
            modal.close();
            this.modal = null;
          }
        }
      }
      const displayed = {
        ...model,
        message: this.modal ? null : (model.message ?? this.unavailableMessage?.message ?? null),
      };
      const handlers = createDashboardHandlers(
        controller,
        (id, origin) => this.openHabit(id, origin),
        () => {
          this.unavailableMessage = null;
        },
      );
      handlers.createHabit = (name, target) => this.createHabit(controller, name, target);
      renderDashboard(this.contentEl, displayed, handlers);
    } finally {
      this.rendering = false;
    }
  }

  private async createHabit(
    controller: DashboardController,
    name: string,
    target: number,
  ): Promise<WriteResult | null> {
    this.unavailableMessage = null;
    // Rebinding or reopening changes the subscription and owns a different form session.
    const subscription = this.unsubscribe;
    const fields = () => ({
      name: this.contentEl.querySelector<HTMLInputElement>(
        '[data-form-key="create"] [data-field-key="name"]',
      ),
      target: this.contentEl.querySelector<HTMLSelectElement>(
        '[data-form-key="create"] [data-field-key="target"]',
      ),
    });
    const submitted = fields();
    const rawName = submitted.name?.value;
    const rawTarget = submitted.target?.value;
    const result = await controller.createHabit(name, target);
    if (
      result?.status === 'applied' &&
      this.active &&
      this.controller === controller &&
      this.unsubscribe === subscription
    ) {
      const current = fields();
      if (
        current.name &&
        current.target &&
        current.name.value === rawName &&
        current.target.value === rawTarget
      ) {
        current.name.value = '';
        current.target.value = '7';
      }
    }
    return result;
  }

  private rememberDraft(habitId: string, draft: HabitDraft): void {
    if (Object.keys(draft).length) {
      this.drafts.set(habitId, draft);
    } else {
      this.drafts.delete(habitId);
    }
  }

  private openHabit(habitId: string, origin: 'grid' | 'archived' = 'grid'): void {
    if (!this.active || this.modal || this.controller.getViewModel().settingsChanging) {
      return;
    }
    const controller = this.controller;
    const model = controller.getViewModel();
    const initial = controller.getHabitDetail(habitId, Number(model.today.slice(0, 4)));
    if (!initial) {
      return;
    }
    const scrollTop = this.contentEl.scrollTop;
    this.unavailableMessage = null;
    const modal = new HabitDetailModal(this.app, controller, initial, {
      draft: this.drafts.get(habitId),
      onClose: (draft) => {
        if (this.modal === modal) {
          this.modal = null;
        }
        if (
          this.active &&
          this.controller === controller &&
          !controller.getViewModel().settingsChanging &&
          controller.getHabitDetail(habitId, initial.history.year)
        ) {
          this.rememberDraft(habitId, draft);
        }
        if (this.active) {
          this.render();
          this.contentEl.scrollTop = scrollTop;
          const restore = () => {
            if (this.active && !this.modal) {
              this.focusOrigin(habitId, origin);
            }
          };
          restore();
          queueMicrotask(restore);
        }
      },
      onSaved: (field, raw) => {
        if (!this.active || this.controller !== controller) {
          return;
        }
        const draft = this.drafts.get(habitId);
        if (draft?.[field] === raw) {
          delete draft[field];
          if (Object.keys(draft).length === 0) {
            this.drafts.delete(habitId);
          }
        }
        if (this.modal?.controller === controller && this.modal.habitId === habitId) {
          this.modal.acceptSaved(field, raw);
        }
      },
      onDeleted: () => {
        if (this.active && this.controller === controller) {
          this.drafts.delete(habitId);
          if (this.unavailableMessage?.habitId === habitId) {
            this.unavailableMessage = null;
          }
          this.render();
        }
      },
      onSettled: () => {
        if (this.active && this.controller === controller) {
          this.render();
        }
      },
    });
    this.modal = modal;
    modal.open();
    modal.updateFromController(model, model.duplicateHabitIds.has(habitId));
  }

  private focusOrigin(habitId: string, origin: 'grid' | 'archived'): void {
    const controls = [
      ...this.contentEl.querySelectorAll<HTMLButtonElement>('[data-open-habit-id]'),
    ];
    const matches = controls.filter((button) => button.dataset.openHabitId === habitId);
    let target: HTMLElement | undefined =
      matches.find(
        (button) =>
          !!button.closest('[data-disclosure-key="archived"]') === (origin === 'archived'),
      ) ?? matches[0];
    const archive = target?.closest<HTMLDetailsElement>('[data-disclosure-key="archived"]');
    if (archive && !archive.open) {
      target = archive.querySelector<HTMLElement>('summary') ?? undefined;
    }
    target ??=
      this.contentEl.querySelector<HTMLElement>('[data-disclosure-key="archived"] > summary') ??
      controls[0] ??
      this.contentEl.querySelector<HTMLElement>('form[data-form-key="create"] input') ??
      undefined;
    target?.focus({ preventScroll: true });
  }
}
