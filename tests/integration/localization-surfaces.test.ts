import { describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import HabitTrackerPlugin from '../../src/main';
import { DashboardController } from '../../src/ui/dashboard-controller';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { HabitDashboardView } from '../../src/ui/dashboard-view';
import { renderHabitGrid } from '../../src/ui/week-dashboard';
import { HabitTrackerSettingTab } from '../../src/ui/settings-tab';
import { parseHabitForm } from '../../src/ui/habit-form';
import { createFakeApp } from '../helpers/fake-obsidian-app';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

function useLanguage(language: string): void {
  vi.spyOn(obsidian, 'getLanguage').mockReturnValue(language);
}

function render(harness: ReturnType<typeof createHarness>, container: HTMLElement): void {
  renderDashboard(
    container,
    harness.controller.getViewModel(),
    createDashboardHandlers(harness.controller),
  );
}

const manifest = {
  id: 'habit-rhythm-tracker',
  version: '0.1.2',
  minAppVersion: '1.14.4',
  isDesktopOnly: false,
};

describe('US1: Portuguese interface follows Obsidian', () => {
  it('renders the dashboard, history and management in pt-BR', async () => {
    useLanguage('pt-BR');
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        name: 'Academia',
        targets: [{ week: '2026-10-26', days: 4 }],
        completions: ['2026-10-27'],
      }),
      'Habits/Academia.md',
    );
    await harness.controller.load();
    const container = document.createElement('div');
    document.body.append(container);
    harness.controller.subscribe(() => render(harness, container));
    render(harness, container);

    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '26 out – 1 nov 2026',
    );
    expect(container.querySelector('.habit-tracker-week-range')?.textContent).toBe(
      '26 out – 1 nov',
    );
    expect(container.querySelector('.habit-tracker-week-year')?.textContent).toBe('2026');
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('Esta semana');
    expect(container.querySelectorAll('.habit-tracker-day-head')).toHaveLength(7);
    expect(
      container.querySelector('.habit-tracker-day-head .habit-tracker-weekday')?.textContent,
    ).toBe('seg');
    expect(container.querySelector('.habit-tracker-corner')?.textContent).toBe('Hábito');
    expect(container.querySelector('.habit-tracker-habit-status')?.textContent).toBe(
      '1 / 4 · Em andamento',
    );
    expect(container.querySelector('.habit-tracker-meta-streak')?.textContent).toBe(
      'Sequência: 0 semanas',
    );
    expect(
      container
        .querySelector<HTMLInputElement>('input[data-date="2026-10-28"]')
        ?.getAttribute('aria-label'),
    ).toBe('Academia, quarta-feira, 28 de outubro de 2026, não concluído, disponível');
    expect(container.textContent).not.toContain('This week');
    expect(container.textContent).not.toContain('Streak:');
    expect(container.textContent).not.toContain('Archived');

    const form = container.querySelector<HTMLFormElement>('form[data-testid="create-habit-form"]');
    expect(form?.getAttribute('aria-label')).toBe('Criar um hábito');
    expect(form?.querySelector('label')?.textContent).toContain('Nome do hábito');
    expect(form?.querySelector<HTMLInputElement>('input')?.placeholder).toBe('ex.: Academia');
    expect(form?.querySelector('select')?.getAttribute('aria-label')).toBe('Meta semanal');
    expect(
      [...(form?.querySelectorAll('option') ?? [])].map((option) => option.textContent),
    ).toContain('4 dias / semana');
    expect(form?.querySelector('button[type="submit"]')?.textContent).toBe('Criar hábito');

    const emptyAlert = form?.querySelector('[role="alert"]');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(emptyAlert?.textContent).toContain('Informe um nome de hábito');
    expect(() => parseHabitForm('Academia', '9')).toThrow(
      'A meta semanal deve ser um número inteiro de 1 a 7',
    );

    const manage = container.querySelector<HTMLDetailsElement>(
      'details[data-disclosure-key="manage"]',
    );
    expect(manage?.querySelector('summary')?.textContent).toContain('Gerenciar hábitos');
    expect(manage?.textContent).toContain('Hábito');
    expect(manage?.textContent).toContain('Meta semanal');
    expect(manage?.textContent).toContain('Esta semana');
    expect(manage?.textContent).toContain('Sequência');
    expect(manage?.textContent).toContain('Editar');
    expect(manage?.textContent).toContain('Nome');
    expect(manage?.textContent).toContain('Renomear');
    expect(manage?.textContent).toContain('Meta semanal a partir da próxima semana');
    expect(manage?.textContent).toContain('Salvar meta semanal');
    expect(manage?.textContent).toContain('Cor');
    expect(manage?.textContent).toContain('Usar cor do tema');
    expect(manage?.textContent).toContain('Ver histórico');
    expect(manage?.textContent).toContain('Arquivar a partir da próxima semana');
    expect(manage?.textContent).toContain('1 dia / semana');

    container
      .querySelector<HTMLButtonElement>('button[aria-label="Ver histórico de Academia"]')
      ?.click();
    const history = container.querySelector('[data-testid="habit-history"]');
    expect(history?.getAttribute('aria-label')).toBe('Histórico de Academia');
    expect(history?.textContent).toContain('Histórico do hábito');
    expect(history?.textContent).toContain('Sequência atual');
    expect(history?.textContent).toContain('Melhor sequência');
    expect(history?.textContent).toContain('Dias marcados');
    expect(history?.textContent).toContain('Atividade');
    expect(history?.textContent).toContain('Marcado');
    expect(history?.textContent).toContain('Não marcado');
    expect(history?.textContent).toContain('Semana arquivada');
    expect(history?.textContent).toContain('Futuro / antes do início');
    expect(history?.textContent).toContain('As sequências contam semanas bem-sucedidas.');
    expect(history?.textContent).toContain('out');
    expect(history?.textContent).toContain('seg');
    expect(history?.querySelector('[aria-label*="28 de outubro de 2026"]')).not.toBeNull();
    expect(
      history?.querySelector<HTMLButtonElement>('button[aria-label="Fechar histórico de Academia"]')
        ?.textContent,
    ).toBe('Fechar');
  });

  it('renders empty, loading and note-problem states in pt-BR', async () => {
    useLanguage('pt-BR');
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);
    expect(container.textContent).toContain('Comece com um hábito');
    expect(container.textContent).toContain(
      'Adicione seu primeiro hábito acima e marque os dias em que cumpri-lo.',
    );

    const loading = document.createElement('div');
    renderDashboard(
      loading,
      { ...harness.controller.getViewModel(), loading: true },
      createDashboardHandlers(harness.controller),
    );
    expect(loading.textContent).toContain('Carregando hábitos…');

    const emptyWeek = document.createElement('div');
    renderHabitGrid(
      emptyWeek,
      { ...harness.controller.getViewModel(), weeks: [] },
      createDashboardHandlers(harness.controller),
    );
    expect(emptyWeek.textContent).toContain('Nenhuma semana para exibir.');

    const issues = document.createElement('div');
    renderDashboard(
      issues,
      {
        ...harness.controller.getViewModel(),
        issues: [
          { path: 'Habits/Ruim.md', code: 'missing-markers', message: 'Marcadores ausentes' },
        ],
      },
      createDashboardHandlers(harness.controller),
    );
    expect(issues.textContent).toContain('Problemas nas notas');
    expect(issues.textContent).toContain(
      'Estas notas não foram carregadas nem sobrescritas. Corrija a nota no cofre e atualize.',
    );

    const failure = document.createElement('div');
    vi.spyOn(harness.repository, 'discover').mockRejectedValueOnce(new Error('falhou'));
    await harness.controller.load();
    render(harness, failure);
    expect(failure.querySelector('[role="alert"]')?.textContent).toBe(
      'Não foi possível carregar os hábitos: falhou',
    );
  });

  it('localizes commands, ribbon, view title and settings in pt-BR', async () => {
    useLanguage('pt-BR');
    const { app, workspace } = createFakeApp();
    const plugin = new HabitTrackerPlugin(app, manifest as never) as HabitTrackerPlugin & {
      commands: Array<{ id: string; name: string }>;
      ribbons: Array<{ icon: string; title: string }>;
    };
    vi.spyOn(window, 'setInterval').mockReturnValue(1 as never);
    vi.spyOn(DashboardController.prototype, 'load').mockResolvedValue();
    vi.spyOn(DashboardController.prototype, 'refreshClock').mockResolvedValue({
      dateChanged: false,
      weekChanged: false,
    });
    await plugin.onload();

    expect(plugin.commands[0]?.name).toBe('Abrir painel de hábitos');
    expect(plugin.ribbons[0]?.title).toBe('Abrir painel de hábitos');

    const leaf = workspace.addLeaf();
    const view = new HabitDashboardView(leaf, () => {
      throw new Error('not used');
    });
    expect(view.getDisplayText()).toBe('Painel de hábitos');

    const tab = new HabitTrackerSettingTab(app, plugin);
    const definition = tab.getSettingDefinitions()[0];
    if (!definition || !('control' in definition) || definition.control?.type !== 'text') {
      throw new Error('missing text setting');
    }
    expect(definition.name).toBe('Pasta de hábitos');
    expect(definition.desc).toBe('Uma nota Markdown por hábito é descoberta nesta pasta.');
    expect(definition.control.placeholder).toBe('Habits');
    expect(await definition.control.validate?.('')).toBe('Informe um nome de pasta do cofre');
    expect(await definition.control.validate?.('Hábitos')).toBeUndefined();
  });

  it('uses the pt-BR catalog for the Portugal variant', async () => {
    useLanguage('pt');
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Academia' }), 'Habits/Academia.md');
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('Esta semana');
    expect(container.textContent).toContain('Gerenciar hábitos');
    expect(container.textContent).not.toContain('Manage habits');
  });
});
