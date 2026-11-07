import { getIcon } from 'obsidian';
import { getLocale, t, tp } from '../i18n';
import type { WriteResult } from '../storage/guarded-write';
import type { HabitSummaryViewModel } from './dashboard-controller';
import { habitIcon, renderIconPicker } from './habit-icon-picker';
import { InfoPopover } from './info-popover';

let editorSequence = 0;

function editorIcon(name: string): HTMLElement {
  const wrapper = createSpan();
  wrapper.className = 'habit-tracker-editor-symbol';
  wrapper.setAttribute('aria-hidden', 'true');
  const icon = getIcon(name);
  if (icon) {
    wrapper.append(icon);
  }
  return wrapper;
}

function buttonLabel(button: HTMLButtonElement, text: string, icon: string): void {
  button.replaceChildren(editorIcon(icon), document.createTextNode(text));
}

export interface HabitDraft {
  name?: string;
  target?: string;
}
export type DraftField = keyof HabitDraft;
export interface HabitEditorHandlers {
  renameHabit(id: string, name: string): Promise<WriteResult | null>;
  changeTarget(id: string, target: number): Promise<WriteResult | null>;
  changeColor(id: string, color: string | null): Promise<WriteResult | null>;
  changeIcon(id: string, icon: string | null): Promise<WriteResult | null>;
  archiveHabit(id: string): Promise<WriteResult | null>;
  reactivateHabit(id: string): Promise<WriteResult | null>;
  cancelPendingArchive(id: string): Promise<WriteResult | null>;
  deleteHabit(id: string): void;
}

function themeAccentHex(): string {
  const probe = createSpan();
  probe.className = 'habit-tracker-theme-accent-probe';
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  const match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
  return match
    ? `#${[match[1], match[2], match[3]].map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`
    : '#8a5cf5';
}

/** Stable form controls; saved values and dirty input have separate lifetimes. */
export class HabitEditor {
  readonly el = createEl('fieldset');
  private habit: HabitSummaryViewModel;
  private readonly nameInput = createEl('input');
  private readonly targetSelect = createEl('select');
  private readonly renameButton = createEl('button');
  private readonly targetButton = createEl('button');
  private readonly colorInput = createEl('input');
  private readonly swatch = createSpan();
  private readonly resetColor = createEl('button');
  private readonly iconSlot = createDiv();
  private readonly stateButton = createEl('button');
  readonly deleteButton = createEl('button');
  private nameBase: string;
  private targetBase: string;
  private lastIcon: string | null | undefined;
  private lastIconName = '';
  private lastIconLocale = '';
  private readonly nameLabel = createEl('label');
  private readonly nameCaption = createSpan();
  private readonly targetCaption = createSpan();
  private readonly targetHint = createEl('p');
  private readonly appearanceCaption = createSpan();
  private readonly targetInfo = new InfoPopover(() => this.closeInformation(false));
  private readonly appearanceInfo = new InfoPopover(() => this.closeInformation(false));
  private readonly stateInfo = new InfoPopover(
    () => this.closeInformation(false),
    this.stateButton,
  );
  private readonly preview = createDiv();
  private readonly previewCaption = createSpan();
  private readonly previewIcon = createSpan();
  private readonly previewName = createSpan();
  private readonly previewTarget = createSpan();

  constructor(
    habit: HabitSummaryViewModel,
    private readonly handlers: HabitEditorHandlers,
    draft: HabitDraft = {},
    private readonly onSaved?: (field: DraftField, raw: string) => void,
  ) {
    this.habit = habit;
    this.nameBase = habit.name;
    this.targetBase = String(habit.pendingTarget ?? habit.configuredTarget ?? 7);
    this.nameInput.value = draft.name ?? this.nameBase;
    this.targetSelect.dataset.fieldKey = 'target';
    this.nameInput.dataset.fieldKey = 'name';
    this.nameInput.type = 'text';
    this.nameInput.required = true;
    this.el.className = 'habit-tracker-editor';
    this.el.dataset.testid = 'habit-editor';
    this.el.dataset.habitId = habit.habitId;
    const editorId = ++editorSequence;
    const rename = createEl('form');
    rename.className = 'habit-tracker-inline-form habit-tracker-editor-name';
    rename.dataset.formKey = `rename:${habit.habitId}`;
    rename.noValidate = true;
    const nameLabel = this.nameLabel;
    const nameHeading = createSpan();
    nameHeading.className = 'habit-tracker-editor-label';
    nameHeading.append(editorIcon('layers'), this.nameCaption);
    nameLabel.append(nameHeading, this.nameInput);
    this.nameInput.addEventListener('input', () => this.updatePreview());
    this.renameButton.type = 'submit';
    this.renameButton.textContent = t('action.rename');
    rename.append(nameLabel, this.renameButton);
    rename.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit('name');
    });
    const target = createEl('form');
    target.className = 'habit-tracker-inline-form';
    target.dataset.formKey = `target:${habit.habitId}`;
    const targetHeading = createDiv();
    targetHeading.className = 'habit-tracker-editor-heading habit-tracker-info-anchor';
    const targetCaption = createEl('label');
    targetCaption.className = 'habit-tracker-editor-label';
    this.targetSelect.id = `habit-tracker-target-${editorId}`;
    targetCaption.htmlFor = this.targetSelect.id;
    targetCaption.append(editorIcon('target'), this.targetCaption);
    targetHeading.append(targetCaption, this.targetInfo.el);
    this.targetSelect.addEventListener('change', () => this.updatePreview());
    this.targetHint.className = 'habit-tracker-editor-help habit-tracker-editor-pending';
    this.targetHint.id = `habit-tracker-target-hint-${editorId}`;
    this.targetSelect.setAttribute('aria-describedby', this.targetHint.id);
    for (let day = 1; day <= 7; day++) {
      const option = createEl('option');
      option.value = String(day);
      option.textContent = tp('form.targetOption', day);
      this.targetSelect.append(option);
    }
    this.targetSelect.value = draft.target ?? this.targetBase;
    this.targetButton.type = 'submit';
    this.targetButton.textContent = t('action.saveTarget');
    target.append(targetHeading, this.targetSelect, this.targetButton);
    target.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit('target');
    });
    const targetGroup = createDiv();
    targetGroup.className = 'habit-tracker-editor-target';
    targetGroup.append(target, this.targetHint);
    const targetColumn = createDiv();
    targetColumn.className = 'habit-tracker-editor-target-column';
    const appearance = createEl('section');
    appearance.className = 'habit-tracker-editor-appearance';
    const appearanceHeading = createEl('h3');
    appearanceHeading.className = 'habit-tracker-editor-label';
    this.appearanceCaption.id = `habit-tracker-appearance-${editorId}`;
    appearance.setAttribute('aria-labelledby', this.appearanceCaption.id);
    appearanceHeading.append(editorIcon('palette'), this.appearanceCaption);
    const appearanceHeader = createDiv();
    appearanceHeader.className = 'habit-tracker-editor-heading habit-tracker-info-anchor';
    appearanceHeader.append(appearanceHeading, this.appearanceInfo.el);
    const appearanceControls = createDiv();
    appearanceControls.className = 'habit-tracker-editor-appearance-controls';
    const appearanceButtons = createDiv();
    appearanceButtons.className = 'habit-tracker-editor-appearance-buttons';
    this.iconSlot.className = 'habit-tracker-editor-icons';
    const colorRow = createDiv();
    colorRow.className = 'habit-tracker-color-row';
    const picker = createEl('label');
    picker.className = 'habit-tracker-color-picker';
    this.colorInput.type = 'color';
    this.colorInput.className = 'habit-tracker-color-input';
    this.swatch.className = 'habit-tracker-color-swatch';
    this.swatch.setAttribute('aria-hidden', 'true');
    picker.append(this.colorInput, this.swatch);
    this.colorInput.addEventListener('change', () => {
      void handlers.changeColor(habit.habitId, this.colorInput.value);
    });
    this.resetColor.type = 'button';
    this.resetColor.className = 'habit-tracker-color-reset';
    this.resetColor.textContent = t('action.useThemeColor');
    this.resetColor.addEventListener('click', () => {
      void handlers.changeColor(habit.habitId, null);
    });
    colorRow.append(picker, this.resetColor);
    appearanceButtons.append(colorRow, this.iconSlot);
    appearanceControls.append(appearanceHeader, appearanceButtons);
    this.preview.className = 'habit-tracker-editor-preview';
    this.preview.dataset.testid = 'habit-editor-preview';
    // The inputs and picker already expose these values to assistive technology.
    this.preview.setAttribute('aria-hidden', 'true');
    this.previewIcon.className = 'habit-tracker-editor-preview-icon';
    const previewText = createDiv();
    previewText.className = 'habit-tracker-editor-preview-text';
    this.previewCaption.className = 'habit-tracker-editor-preview-caption';
    this.previewName.className = 'habit-tracker-editor-preview-name';
    this.previewTarget.className = 'habit-tracker-editor-preview-target';
    previewText.append(this.previewCaption, this.previewName, this.previewTarget);
    this.preview.append(this.previewIcon, previewText);
    targetColumn.append(targetGroup, this.preview);
    const actions = createDiv();
    actions.className =
      'habit-tracker-actions habit-tracker-editor-footer habit-tracker-info-anchor';
    this.stateButton.type = 'button';
    this.stateButton.dataset.action = 'archive-state';
    this.stateButton.addEventListener('click', () => {
      if (this.habit.pendingArchive) {
        void handlers.cancelPendingArchive(habit.habitId);
      } else if (this.habit.state === 'archived') {
        void handlers.reactivateHabit(habit.habitId);
      } else {
        void handlers.archiveHabit(habit.habitId);
      }
    });
    this.deleteButton.type = 'button';
    this.deleteButton.className = 'habit-tracker-delete-button';
    this.deleteButton.dataset.deleteHabitId = habit.habitId;
    this.deleteButton.textContent = t('action.deleteHabit');
    this.deleteButton.addEventListener('click', () => handlers.deleteHabit(habit.habitId));
    actions.append(this.stateButton, this.deleteButton, this.stateInfo.el);
    appearance.append(appearanceControls, actions);
    this.el.append(rename, targetColumn, appearance);
    this.update(habit);
  }

  getDraft(): HabitDraft {
    return {
      ...(this.nameInput.value !== this.nameBase ? { name: this.nameInput.value } : {}),
      ...(this.targetSelect.value !== this.targetBase ? { target: this.targetSelect.value } : {}),
    };
  }

  closeIconPicker(): boolean {
    const picker = this.iconSlot.querySelector<HTMLDetailsElement>('details');
    if (!picker?.open) {
      return false;
    }
    picker.dispatchEvent(new Event('habit-tracker:close-icon-picker'));
    return true;
  }

  closeInformation(restoreFocus = true): boolean {
    let closed = false;
    for (const info of [this.targetInfo, this.appearanceInfo, this.stateInfo]) {
      closed = info.close(restoreFocus) || closed;
    }
    return closed;
  }

  dispose(): void {
    this.closeInformation(false);
    this.iconSlot
      .querySelector('details')
      ?.dispatchEvent(new Event('habit-tracker:dispose-icon-picker'));
  }

  acceptSaved(field: DraftField, raw: string): void {
    const input = field === 'name' ? this.nameInput : this.targetSelect;
    if (input.value === raw) {
      input.value = field === 'name' ? this.nameBase : this.targetBase;
    }
    this.updatePreview();
  }

  private updatePreview(): void {
    this.previewCaption.textContent = t('editor.preview');
    this.previewName.textContent = this.nameInput.value.trim() || this.habit.name;
    this.previewTarget.textContent = t('editor.previewTarget', {
      target: tp('form.targetOption', Number(this.targetSelect.value)),
    });
    const icon = habitIcon(this.habit.icon);
    this.previewIcon.replaceChildren(...(icon ? [icon] : []));
    this.previewIcon.hidden = !icon;
  }

  private async submit(field: DraftField): Promise<void> {
    if (this.el.disabled) {
      return;
    }
    const raw = field === 'name' ? this.nameInput.value : this.targetSelect.value;
    const result =
      field === 'name'
        ? await this.handlers.renameHabit(this.habit.habitId, raw)
        : await this.handlers.changeTarget(this.habit.habitId, Number(raw));
    if (result?.status === 'applied') {
      this.acceptSaved(field, raw);
      this.onSaved?.(field, raw);
    }
  }

  update(habit: HabitSummaryViewModel, duplicateName = false): void {
    const draft = this.getDraft();
    this.el.setAttribute('aria-label', t('details.editAria', { name: habit.name }));
    this.nameCaption.textContent = t('form.name');
    this.targetCaption.textContent = t('editor.weeklyTarget');
    this.targetHint.hidden = habit.pendingTarget === null;
    this.targetHint.textContent =
      habit.pendingTarget === null ? '' : tp('manage.pendingTarget', habit.pendingTarget);
    this.targetInfo.update(t('editor.targetInfoAria'), t('editor.targetHint'));
    this.appearanceCaption.textContent = t('editor.appearance');
    this.appearanceInfo.update(t('editor.appearanceInfoAria'), t('editor.appearanceHint'));
    this.renameButton.textContent = t('action.rename');
    buttonLabel(this.targetButton, t('action.saveTarget'), 'bookmark');
    this.resetColor.textContent = t('action.useThemeColor');
    buttonLabel(this.deleteButton, t('action.deleteHabit'), 'trash-2');
    for (const option of this.targetSelect.options) {
      option.textContent = tp('form.targetOption', Number(option.value));
    }
    this.habit = habit;
    this.nameBase = habit.name;
    this.targetBase = String(habit.pendingTarget ?? habit.configuredTarget ?? 7);
    if (draft.name === undefined) {
      this.nameInput.value = this.nameBase;
    }
    if (draft.target === undefined) {
      this.targetSelect.value = this.targetBase;
    }
    this.nameInput.setAttribute('aria-label', t('manage.nameAria', { name: habit.name }));
    this.renameButton.setAttribute('aria-label', t('manage.renameAria', { name: habit.name }));
    this.targetSelect.setAttribute('aria-label', t('manage.targetAria', { name: habit.name }));
    this.targetButton.setAttribute('aria-label', t('manage.saveTargetAria', { name: habit.name }));
    this.colorInput.value = habit.color ?? themeAccentHex();
    this.colorInput.setAttribute('aria-label', t('manage.colorAria', { name: habit.name }));
    this.swatch.style.background = habit.color ?? 'var(--interactive-accent)';
    this.resetColor.disabled = habit.color === null;
    this.resetColor.setAttribute(
      'aria-label',
      t(habit.color ? 'manage.useThemeColorAria' : 'manage.themeColorActiveAria', {
        name: habit.name,
      }),
    );
    if (
      this.lastIcon !== habit.icon ||
      this.lastIconName !== habit.name ||
      this.lastIconLocale !== getLocale()
    ) {
      const previous = this.iconSlot.querySelector<HTMLDetailsElement>('details');
      const active = this.iconSlot.ownerDocument.activeElement;
      const hadFocus = !!active && this.iconSlot.contains(active);
      const label = active?.getAttribute('aria-label');
      const values = new Map(
        [...this.iconSlot.querySelectorAll<HTMLInputElement>('input')].map((input) => [
          input.name || input.dataset.fieldKey,
          input.value,
        ]),
      );
      const next = renderIconPicker(habit, (id, icon) => this.handlers.changeIcon(id, icon));
      next.open = previous?.open ?? false;
      for (const input of next.querySelectorAll<HTMLInputElement>('input')) {
        const value = values.get(input.name || input.dataset.fieldKey);
        if (value !== undefined) {
          input.value = value;
        }
      }
      previous?.dispatchEvent(new Event('habit-tracker:dispose-icon-picker'));
      this.iconSlot.replaceChildren(next);
      if (next.open) {
        next
          .querySelector('input[type="search"]')
          ?.dispatchEvent(new Event('habit-tracker:restore-icon-search'));
      }
      if (hadFocus) {
        const target = [...next.querySelectorAll<HTMLElement>('[aria-label]')].find(
          (element) => element.getAttribute('aria-label') === label,
        );
        (target?.instanceOf(HTMLButtonElement) && target.disabled
          ? next.querySelector<HTMLElement>('summary')
          : (target ?? next.querySelector<HTMLElement>('summary'))
        )?.focus({ preventScroll: true });
      }
      this.lastIcon = habit.icon;
      this.lastIconName = habit.name;
      this.lastIconLocale = getLocale();
    }
    const state = habit.pendingArchive
      ? 'cancelPendingArchive'
      : habit.state === 'archived'
        ? 'reactivate'
        : 'archive';
    buttonLabel(
      this.stateButton,
      t(`action.${state}`),
      state === 'archive' ? 'calendar-clock' : 'archive-restore',
    );
    this.stateButton.setAttribute('aria-label', t(`manage.${state}Aria`, { name: habit.name }));
    this.stateInfo.update(
      t(state === 'reactivate' ? 'editor.reactivateInfoAria' : 'editor.archiveInfoAria'),
      t(`editor.${state}Hint`),
    );
    this.deleteButton.setAttribute(
      'aria-label',
      duplicateName
        ? t('delete.actionPathAria', { name: habit.name, path: habit.path })
        : t('delete.actionAria', { name: habit.name }),
    );
    if (habit.color) {
      this.el.style.setProperty('--ht-habit-color', habit.color);
    } else {
      this.el.style.removeProperty('--ht-habit-color');
    }
    this.updatePreview();
  }
}
