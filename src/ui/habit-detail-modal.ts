import { Modal, Scope, type App } from 'obsidian';
import { getLocale, t } from '../i18n';
import type { WriteResult } from '../storage/guarded-write';
import type {
  DashboardController,
  DashboardMessage,
  DashboardViewModel,
  DeletionRequest,
  HabitDetailViewModel,
} from './dashboard-controller';
import { HabitEditor, type DraftField, type HabitDraft } from './habit-editor';
import { renderHabitHistory } from './habit-history-view';

interface DetailOptions {
  draft?: HabitDraft;
  onClose(draft: HabitDraft): void;
  onSaved(field: DraftField, raw: string): void;
  onDeleted(): void;
  onSettled(): void;
}
let titleSequence = 0;
const backgroundOwners = new WeakMap<HTMLElement, { count: number; wasInert: boolean }>();

export class HabitDetailModal extends Modal {
  readonly habitId: string;
  private readonly editor: HabitEditor;
  private readonly editorSection = createDiv();
  private readonly historyEl = createDiv();
  private readonly feedback = createDiv();
  private readonly pathEl = createEl('p');
  private readonly nameEl = createSpan();
  private readonly confirmationSlot = createDiv();
  private confirmation: HTMLElement | null = null;
  private request: DeletionRequest | null = null;
  private preparing: AbortController | null = null;
  private submitting = false;
  private closed = false;
  private year: number;
  private previousHistory = '';
  private previousMessage: DashboardMessage | null = null;
  private duplicateName = false;
  private readonly isolatedBackground: HTMLElement[] = [];

  constructor(
    app: App,
    readonly controller: DashboardController,
    initial: HabitDetailViewModel,
    private readonly options: DetailOptions,
  ) {
    super(app);
    this.habitId = initial.habitId;
    this.year = initial.history.year;
    this.scope = new Scope(this.scope);
    this.scope.register([], 'Escape', () => {
      if (this.editor.closeInformation() || this.editor.closeIconPicker()) {
        return false;
      }
      if (this.request && !this.submitting) {
        this.cancelConfirmation();
      } else {
        this.close();
      }
      return false;
    });
    const write = async (
      action: () => Promise<WriteResult | null>,
    ): Promise<WriteResult | null> => {
      const result = await action();
      const latest = controller.getHabitDetail(this.habitId, this.year);
      // A completed submission also updates the baseline of an already detached editor.
      if (latest) {
        this.editor.update(latest, this.duplicateName);
      }
      return result;
    };
    this.editor = new HabitEditor(
      initial,
      {
        renameHabit: (id, name) => write(() => controller.renameHabit(id, name)),
        changeTarget: (id, target) => write(() => controller.changeTarget(id, target)),
        changeColor: (id, color) => write(() => controller.changeColor(id, color)),
        changeIcon: (id, icon) => write(() => controller.changeIcon(id, icon)),
        archiveHabit: (id) => write(() => controller.archiveHabit(id)),
        reactivateHabit: (id) => write(() => controller.reactivateHabit(id)),
        cancelPendingArchive: (id) => write(() => controller.cancelPendingArchive(id)),
        deleteHabit: () => {
          void this.prepareDeletion();
        },
      },
      options.draft,
      (field, raw) => options.onSaved(field, raw),
    );
    this.modalEl.classList.add('habit-tracker-detail-modal');
    this.modalEl.dataset.habitId = this.habitId;
    this.modalEl.setAttribute('role', 'dialog');
    this.modalEl.setAttribute('aria-modal', 'true');
    this.titleEl.id = `habit-tracker-detail-title-${++titleSequence}`;
    this.titleEl.tabIndex = -1;
    this.titleEl.replaceChildren(this.nameEl);
    this.modalEl.setAttribute('aria-labelledby', this.titleEl.id);
    this.modalEl.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.moveFocus(event.shiftKey);
        }
      },
      true,
    );
    this.pathEl.className = 'habit-tracker-detail-path';
    this.pathEl.id = `${this.titleEl.id}-path`;
    this.editorSection.className = 'habit-tracker-detail-editor';
    this.editorSection.append(this.editor.el);
    this.historyEl.className = 'habit-tracker-detail-history';
    this.contentEl.append(
      this.pathEl,
      this.feedback,
      this.editorSection,
      this.confirmationSlot,
      this.historyEl,
    );
  }

  override open(): void {
    super.open();
    this.titleEl.focus({ preventScroll: true });
  }

  override onOpen(): void {
    for (const element of this.containerEl.ownerDocument.body.children) {
      if (!element.instanceOf(HTMLElement) || element.contains(this.containerEl)) {
        continue;
      }
      const ownership = backgroundOwners.get(element) ?? {
        count: 0,
        wasInert: Boolean(element.inert),
      };
      ownership.count += 1;
      backgroundOwners.set(element, ownership);
      element.inert = true;
      this.isolatedBackground.push(element);
    }
    const close = this.modalEl.querySelector<HTMLElement>(
      '.modal-close-button, .modal-header-button',
    );
    if (close) {
      close.tabIndex = 0;
      close.setAttribute('role', 'button');
      close.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.close();
        }
      });
    }
    const detail = this.controller.getHabitDetail(this.habitId, this.year);
    if (detail) {
      this.update(detail, this.controller.getViewModel());
    }
  }

  override onClose(): void {
    this.editor.dispose();
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const element of this.isolatedBackground) {
      const ownership = backgroundOwners.get(element);
      if (ownership && --ownership.count === 0) {
        element.inert = ownership.wasInert;
        backgroundOwners.delete(element);
      }
    }
    this.isolatedBackground.length = 0;
    const preparation = this.preparing;
    const request = this.request;
    this.preparing = null;
    this.request = null;
    // Clear the owning view's reference before cancellation emits another render.
    this.options.onClose(this.editor.getDraft());
    preparation?.abort();
    if (request && !this.submitting) {
      this.controller.cancelDeletion(this.habitId, request);
    }
  }

  get habitName(): string {
    return this.nameEl.textContent ?? '';
  }

  private moveFocus(backward: boolean): void {
    const controls = [
      ...this.modalEl.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], summary, [tabindex]',
      ),
    ].filter((element) => {
      if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[inert]')) {
        return false;
      }
      let closed = element.closest('details:not([open])');
      while (closed) {
        if (!closed.querySelector(':scope > summary')?.contains(element)) {
          return false;
        }
        closed = closed.parentElement?.closest('details:not([open])') ?? null;
      }
      return element.getClientRects().length > 0;
    });
    const active = this.modalEl.ownerDocument.activeElement;
    const index = controls.findIndex((element) => element === active);
    const next = backward
      ? index <= 0
        ? controls.length - 1
        : index - 1
      : (index + 1) % controls.length;
    (controls[next] ?? this.titleEl).focus();
  }
  updateFromController(model: DashboardViewModel, duplicateName: boolean): void {
    const detail = this.controller.getHabitDetail(this.habitId, this.year);
    if (detail) {
      this.update(detail, model, duplicateName);
    }
  }

  get deletionInFlight(): boolean {
    return this.submitting;
  }
  getDraft(): HabitDraft {
    return this.editor.getDraft();
  }
  acceptSaved(field: DraftField, raw: string): void {
    this.editor.acceptSaved(field, raw);
  }

  update(
    detail: HabitDetailViewModel,
    model: DashboardViewModel,
    duplicateName = this.duplicateName,
  ): void {
    if (this.closed) {
      return;
    }
    this.duplicateName = duplicateName;
    const scrollTop = this.contentEl.scrollTop;
    this.year = detail.history.year;
    this.nameEl.textContent = detail.name;
    if (detail.color) {
      this.modalEl.style.setProperty('--ht-habit-color', detail.color);
    } else {
      this.modalEl.style.removeProperty('--ht-habit-color');
    }
    this.pathEl.hidden = !duplicateName;
    this.pathEl.textContent = detail.path;
    this.modalEl.setAttribute(
      'aria-labelledby',
      duplicateName ? `${this.titleEl.id} ${this.pathEl.id}` : this.titleEl.id,
    );
    this.modalEl
      .querySelector<HTMLElement>('.modal-close-button, .modal-header-button')
      ?.setAttribute('aria-label', t('details.closeAria', { name: detail.name }));
    this.editor.update(detail, duplicateName);
    const confirmationChanged = !!(
      this.request &&
      !this.submitting &&
      (this.request.name !== detail.name || this.request.path !== detail.path)
    );
    if (confirmationChanged) {
      this.cancelConfirmation('conflict');
      model = this.controller.getViewModel();
    }
    this.updateConfirmationText();
    const historyKey = JSON.stringify([getLocale(), detail.name, detail.color, detail.history]);
    if (historyKey !== this.previousHistory) {
      const previous = this.historyEl.querySelector<HTMLElement>('.habit-tracker-history-scroll');
      const sameYear = previous?.dataset.year === String(this.year);
      const left = previous?.scrollLeft ?? 0;
      const active = this.modalEl.ownerDocument.activeElement;
      const historyHadFocus = !!active && this.historyEl.contains(active);
      const action = active?.getAttribute('aria-label');
      this.historyEl.replaceChildren();
      renderHabitHistory(this.historyEl, detail, {
        changeHistoryYear: (delta) => {
          const next = this.controller.getHabitDetail(this.habitId, this.year + delta);
          if (next) {
            this.year = next.history.year;
            this.update(next, this.controller.getViewModel());
            this.historyEl
              .querySelector<HTMLElement>('.habit-tracker-history-year')
              ?.focus({ preventScroll: true });
          }
        },
      });
      const calendar = this.historyEl.querySelector<HTMLElement>('.habit-tracker-history-scroll');
      if (calendar && sameYear) {
        calendar.scrollLeft = left;
      } else if (calendar) {
        const anchor = calendar.querySelector<HTMLElement>('[data-history-anchor]');
        if (anchor) {
          calendar.scrollLeft +=
            anchor.getBoundingClientRect().left -
            calendar.getBoundingClientRect().left -
            calendar.clientWidth * 0.75;
        }
      }
      if (historyHadFocus) {
        const control = [...this.historyEl.querySelectorAll<HTMLElement>('[aria-label]')].find(
          (el) => el.getAttribute('aria-label') === action,
        );
        (
          control ?? this.historyEl.querySelector<HTMLElement>('[data-testid="habit-history"]')
        )?.focus({ preventScroll: true });
      }
      this.previousHistory = historyKey;
    }
    this.contentEl.scrollTop = scrollTop;
    this.renderFeedback(model);
    if (confirmationChanged) {
      this.editor.deleteButton.focus({ preventScroll: true });
    }
  }

  private renderFeedback(model: DashboardViewModel): void {
    if (model.message === this.previousMessage) {
      return;
    }
    this.previousMessage = model.message;
    this.feedback.replaceChildren();
    if (!model.message) {
      return;
    }
    const message = createEl('p');
    message.dataset.testid = 'status-message';
    message.className = `habit-tracker-message message-${model.message.kind}`;
    message.textContent = model.message.text;
    message.setAttribute('role', model.message.kind === 'error' ? 'alert' : 'status');
    this.feedback.append(message);
    if (model.message.kind !== 'info') {
      message.tabIndex = -1;
      message.focus();
    }
  }

  private async prepareDeletion(): Promise<void> {
    if (
      this.closed ||
      this.preparing ||
      this.request ||
      this.submitting ||
      this.controller.isDeletionPending(this.habitId) ||
      this.controller.getViewModel().settingsChanging
    ) {
      return;
    }
    const preparation = new AbortController();
    this.preparing = preparation;
    this.editor.el.disabled = true;
    let failed = false;
    let conflict = false;
    try {
      const request = await this.controller.prepareDeletion(this.habitId, preparation.signal);
      // Teardown canceled owned work; a late continuation must not cancel a newer request.
      if (this.closed) {
        if (request) {
          this.controller.cancelDeletion(this.habitId, request);
        }
        return;
      }
      const latest = this.controller.getHabitDetail(this.habitId, this.year);
      if (
        request &&
        latest?.name === request.name &&
        latest.path === request.path &&
        this.controller.isDeletionPending(this.habitId) &&
        !this.controller.getViewModel().settingsChanging
      ) {
        this.request = request;
        this.showConfirmation();
      } else if (request) {
        this.controller.cancelDeletion(this.habitId, request, 'conflict');
        conflict = true;
      }
    } catch {
      if (!this.closed) {
        const request = this.request;
        this.request = null;
        if (request) {
          this.controller.cancelDeletion(this.habitId, request);
        }
        failed = true;
      }
    } finally {
      this.preparing = null;
      if (!this.closed && !this.request) {
        this.editor.el.disabled = false;
        this.options.onSettled();
        if (failed) {
          this.showDeletionError(false);
        } else if (conflict) {
          this.editor.deleteButton.focus({ preventScroll: true });
        }
      }
    }
  }

  private showConfirmation(): void {
    if (!this.request) {
      return;
    }
    const area = createDiv();
    area.className = 'habit-tracker-delete-confirmation';
    area.setAttribute('role', 'group');
    const question = createEl('p');
    question.id = `${this.titleEl.id}-delete-question`;
    area.setAttribute('aria-labelledby', question.id);
    question.textContent = t('delete.question', { name: this.request.name });
    const actions = createDiv();
    actions.className = 'habit-tracker-delete-actions';
    const cancel = createEl('button');
    cancel.type = 'button';
    cancel.dataset.action = 'cancel-delete';
    cancel.setAttribute('aria-describedby', question.id);
    cancel.textContent = t('action.cancel');
    cancel.addEventListener('click', () => this.cancelConfirmation());
    const remove = createEl('button');
    remove.type = 'button';
    remove.className = 'mod-warning';
    remove.dataset.action = 'confirm-delete';
    remove.setAttribute('aria-describedby', question.id);
    remove.textContent = t('action.delete');
    remove.addEventListener('click', () => {
      void this.confirmDeletion();
    });
    actions.append(cancel, remove);
    area.append(question, actions);
    this.confirmationSlot.append(area);
    this.confirmation = area;
    cancel.focus({ preventScroll: false });
  }

  private updateConfirmationText(): void {
    if (!this.confirmation || !this.request) {
      return;
    }
    this.confirmation.querySelector('p')!.textContent = t('delete.question', {
      name: this.request.name,
    });
    this.confirmation.querySelector('[data-action="cancel-delete"]')!.textContent =
      t('action.cancel');
    this.confirmation.querySelector('[data-action="confirm-delete"]')!.textContent =
      t('action.delete');
  }

  private showDeletionError(uncertain: boolean): void {
    if (!this.closed) {
      this.renderFeedback({
        ...this.controller.getViewModel(),
        message: { kind: 'error', text: t(uncertain ? 'delete.uncertain' : 'delete.failed') },
      });
    }
  }

  private cancelConfirmation(reason?: 'conflict'): void {
    if (this.submitting) {
      return;
    }
    const request = this.request;
    this.request = null;
    this.confirmation?.remove();
    this.confirmation = null;
    this.editor.el.disabled = false;
    if (request) {
      this.controller.cancelDeletion(this.habitId, request, reason);
    }
    this.editor.deleteButton.focus({ preventScroll: true });
  }

  private async confirmDeletion(): Promise<void> {
    if (!this.request || this.submitting) {
      return;
    }
    const request = this.request;
    this.submitting = true;
    for (const button of this.confirmation?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
      button.disabled = true;
    }
    let failed = false;
    try {
      const result = await this.controller.confirmDeletion(this.habitId, request);
      if (result?.status === 'applied') {
        this.options.onDeleted();
        this.close();
      }
    } catch {
      if (!this.closed) {
        // cancelDeletion never cancels an operation already committing in the controller.
        this.controller.cancelDeletion(this.habitId, request);
        failed = true;
      }
    } finally {
      this.submitting = false;
      this.request = null;
      if (!this.closed) {
        this.confirmation?.remove();
        this.confirmation = null;
        this.editor.el.disabled = false;
        this.options.onSettled();
        if (failed) {
          this.showDeletionError(true);
        }
      }
    }
  }
}
