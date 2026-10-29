import { describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { parseHabitNote } from '../../src/storage/habit-note';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

function useLanguage(language: string): void {
  vi.spyOn(obsidian, 'getLanguage').mockReturnValue(language);
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

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) {
    throw new Error(`missing button: ${label}`);
  }
  return found;
}

describe('US2: complete habit workflow in Portuguese', () => {
  it('creates, marks, navigates, reviews, renames, retargets, archives and reactivates', async () => {
    useLanguage('pt-BR');
    let now = localNoon(2026, 10, 28);
    const { harness, container, render, unsubscribe } = setup(() => now);
    addHabitNote(
      harness.vault.files,
      makeHabit({
        name: 'Academia',
        created: '2025-12-29',
        targets: [{ week: '2025-12-29', days: 2 }],
        completions: ['2025-12-30'],
      }),
      'Habits/Academia.md',
    );
    await harness.controller.load();
    render();

    const mark = async (date: string): Promise<void> => {
      const checkbox = container.querySelector<HTMLInputElement>(
        `input[type="checkbox"][data-date="${date}"]`,
      );
      if (!checkbox) {
        throw new Error(`missing checkbox: ${date}`);
      }
      checkbox.click();
      await vi.waitFor(() =>
        expect(
          harness.controller
            .getViewModel()
            .weeks[0]?.rows[0]?.cells.find((cell) => cell.date === date)?.completed,
        ).toBe(true),
      );
    };

    await mark('2026-10-26');
    await mark('2026-10-27');
    expect(container.querySelector('.habit-tracker-habit-status')?.textContent).toBe(
      '2 / 2 · Concluída',
    );
    expect(container.querySelector('.habit-tracker-meta-streak')?.textContent).toBe(
      'Sequência: 1 semana',
    );

    button(container, 'Semana anterior').click();
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '19 out – 25 out 2026',
    );
    button(container, 'Próxima semana').click();
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '26 out – 1 nov 2026',
    );

    button(container, 'Ver histórico de Academia').click();
    expect(container.textContent).toContain('Histórico do hábito');
    expect(container.textContent).toContain('Sequência atual');
    expect(container.textContent).toContain('1 semana');
    expect(container.textContent).toContain('3 dias');
    button(container, 'Ano anterior do histórico').click();
    expect(container.querySelector('.habit-tracker-history-year')?.textContent).toBe('2025');
    button(container, 'Próximo ano do histórico').click();
    expect(container.querySelector('.habit-tracker-history-year')?.textContent).toBe('2026');

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Nome do hábito Academia"]',
    );
    if (!nameInput) {
      throw new Error('missing name input');
    }
    nameInput.value = 'Academia Nova';
    nameInput
      .closest('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.name).toBe('Academia Nova'),
    );
    expect(parseHabitNote(harness.vault.files.get('Habits/Academia.md') ?? '').habit.name).toBe(
      'Academia Nova',
    );

    button(container, 'Arquivar Academia Nova a partir da próxima semana').click();
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.pendingArchive).toBe(true),
    );
    expect(container.textContent).toContain('Arquivar na próxima semana');
    button(container, 'Cancelar arquivamento pendente de Academia Nova').click();
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.pendingArchive).toBe(false),
    );

    const target = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Meta semanal de Academia Nova a partir da próxima semana"]',
    );
    if (!target) {
      throw new Error('missing target select');
    }
    target.value = '3';
    target.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.pendingTarget).toBe(3),
    );
    expect(container.textContent).toContain(
      'Meta semanal de 3 dias agendada para a próxima semana.',
    );

    button(container, 'Arquivar Academia Nova a partir da próxima semana').click();
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.pendingArchive).toBe(true),
    );
    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();
    expect(harness.controller.getViewModel().habits[0]?.state).toBe('archived');
    expect(container.textContent).toContain('Não há hábitos para acompanhar nesta semana.');

    button(container, 'Reativar Academia Nova esta semana').click();
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.state).toBe('active'),
    );
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Academia.md') ?? '').habit.completions,
    ).toEqual(['2025-12-30', '2026-10-26', '2026-10-27']);

    unsubscribe();
    container.remove();
  });

  it('shows Portuguese conflict, editor-blocked and invalid-note errors', async () => {
    useLanguage('pt-BR');
    const { harness } = setup(() => localNoon(2026, 10, 28));
    addHabitNote(harness.vault.files, makeHabit({ name: 'Academia' }), 'Habits/Academia.md');
    await harness.controller.load();
    const id = harness.controller.getViewModel().habits[0]?.habitId;
    if (!id) {
      throw new Error('missing habit');
    }

    vi.spyOn(harness.writer, 'update').mockResolvedValueOnce({
      status: 'conflict',
      reason: 'snapshot-mismatch',
      baseContent: 'old',
      currentContent: 'new',
    });
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    expect(harness.controller.getViewModel().message).toEqual({
      kind: 'error',
      text: 'A nota mudou enquanto a edição era salva. O salvamento foi interrompido e a nota existente permaneceu inalterada. Revise-a e tente novamente.',
    });

    vi.spyOn(harness.writer, 'update').mockResolvedValueOnce({
      status: 'editor-blocked',
      reason: 'dirty',
    });
    await harness.controller.toggleCompletion(id, '2026-10-27', true);
    expect(harness.controller.getViewModel().message).toEqual({
      kind: 'warning',
      text: 'A nota do hábito tem conteúdo de editor não salvo ou não verificável. Salve ou feche a nota e tente novamente.',
    });

    const invalidPath = 'Habits/Invalido.md';
    addHabitNote(
      harness.vault.files,
      makeHabit({
        id: 'habit-2',
        name: 'Inválido',
        states: [
          { week: '2026-10-26', state: 'active' },
          { week: '2026-11-02', state: 'archived' },
        ],
      }),
      invalidPath,
    );
    const original = (harness.vault.files.get(invalidPath) ?? '').replace(
      '"state": "archived"',
      '"state": "archived",\n      "personal-note": "manter"',
    );
    harness.vault.files.set(invalidPath, original);
    await harness.controller.refresh();
    expect(
      harness.controller.getViewModel().issues.some((issue) => issue.path === invalidPath),
    ).toBe(false);
    const result = await harness.controller.cancelPendingArchive('habit-2');
    expect(result?.status).toBe('failed');
    if (result?.status === 'failed') {
      expect(result.error).toContain('campos extras');
    }
    expect(harness.vault.files.get(invalidPath)).toBe(original);

    harness.vault.files.set('Habits/Ruim.md', '# sem bloco gerenciado');
    await harness.controller.refresh();
    const issue = harness.controller
      .getViewModel()
      .issues.find((candidate) => candidate.path === 'Habits/Ruim.md');
    expect(issue?.message).toBe('Os marcadores da nota de hábito estão ausentes');
  });

  it('preserves a draft and user-authored content across a Portuguese refresh', async () => {
    useLanguage('pt-BR');
    const { harness, container, render } = setup(() => localNoon(2026, 10, 28));
    addHabitNote(
      harness.vault.files,
      makeHabit({ name: 'Corrida de rua' }),
      'Habits/Corrida de rua.md',
    );
    await harness.controller.load();
    render();

    const name = container.querySelector<HTMLInputElement>('form[data-form-key="create"] input');
    const target = container.querySelector<HTMLSelectElement>(
      'form[data-form-key="create"] select',
    );
    if (!name || !target) {
      throw new Error('missing create form');
    }
    name.value = 'Rascunho em português';
    target.value = '3';
    await harness.controller.refresh();
    expect(
      container.querySelector<HTMLInputElement>('form[data-form-key="create"] input')?.value,
    ).toBe('Rascunho em português');
    expect(
      container.querySelector<HTMLSelectElement>('form[data-form-key="create"] select')?.value,
    ).toBe('3');
    expect(container.textContent).toContain('Corrida de rua');
    expect(harness.vault.files.has('Habits/Corrida de rua.md')).toBe(true);
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Corrida de rua.md') ?? '').habit.name,
    ).toBe('Corrida de rua');
  });

  it('shows the pt-BR catalog for the Portugal variant throughout the workflow', async () => {
    useLanguage('pt');
    const { harness, container, render } = setup(() => localNoon(2026, 10, 28));
    addHabitNote(harness.vault.files, makeHabit({ name: 'Academia' }), 'Habits/Academia.md');
    await harness.controller.load();
    render();
    expect(container.textContent).toContain('Gerenciar hábitos');
    expect(container.textContent).toContain('Arquivar a partir da próxima semana');
    expect(container.textContent).not.toContain('Manage habits');
  });
});
