import { describe, expect, it, vi } from 'vitest';
import { parseHabitNote } from '../../src/storage/habit-note';
import * as obsidian from 'obsidian';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';
import { mountDashboard, openHabit, field, submitField } from '../helpers/dashboard-view';

const now = () => localNoon(2026, 11, 6);

describe('habit name uniqueness at submission', () => {
  it.each(['active', 'archived'] as const)(
    'blocks creation using an %s name without writing',
    async (state) => {
      const { controller, vault } = createHarness({ now });
      addHabitNote(
        vault.files,
        makeHabit({
          name: 'Leitura',
          states: [
            { week: '2026-10-26', state: 'active' },
            ...(state === 'archived' ? [{ week: '2026-11-02', state: 'archived' as const }] : []),
          ],
        }),
      );
      await controller.load();
      const before = new Map(vault.files);
      expect(await controller.createHabit('  LEITURA  ', 4)).toBeNull();
      expect(controller.getViewModel().message?.text).toContain('already exists');
      expect(controller.getViewModel().formResetVersion).toBe(0);
      expect(vault.files).toEqual(before);
    },
  );

  it('keeps the rename draft and Portuguese feedback in details when an archived name is reserved', async () => {
    vi.spyOn(obsidian, 'getLanguage').mockReturnValue('pt-BR');
    const { controller, vault } = createHarness({ now });
    addHabitNote(
      vault.files,
      makeHabit({
        id: 'read',
        name: 'Leitura',
        states: [
          { week: '2026-10-26', state: 'active' },
          { week: '2026-11-02', state: 'archived' },
        ],
      }),
    );
    addHabitNote(vault.files, makeHabit({ id: 'code', name: 'Programar' }));
    const view = await mountDashboard(controller);
    const dialog = openHabit(view, 'code');

    const input = field<HTMLInputElement>(dialog, 'name');
    input.value = 'leitura';
    const before = new Map(vault.files);
    submitField(dialog, 'name');
    await vi.waitFor(() =>
      expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Já existe um hábito'),
    );
    expect(input.value).toBe('leitura');
    expect(vault.files).toEqual(before);
    expect(vault.processCount).toBe(0);
  });

  it('retains existing duplicates and supports their other edits and explicit resolution', async () => {
    const { controller, vault } = createHarness({ now });
    const first = addHabitNote(
      vault.files,
      makeHabit({ id: 'first', name: 'Reading' }),
      'Habits/A.md',
    );
    const second = addHabitNote(
      vault.files,
      makeHabit({ id: 'second', name: 'Reading' }),
      'Habits/B.md',
    );
    const before = new Map(vault.files);
    await controller.load();
    expect(controller.getViewModel().habits).toHaveLength(2);
    expect(vault.files).toEqual(before);
    expect((await controller.changeTarget('first', 3))?.status).toBe('applied');
    expect((await controller.renameHabit('first', 'Reading'))?.status).toBe('applied');
    expect((await controller.renameHabit('first', 'Books'))?.status).toBe('applied');
    expect(parseHabitNote(vault.files.get(first)!).habit.name).toBe('Books');
    expect(vault.files.get(second)).toBe(before.get(second));
    expect(vault.trashCount).toBe(0);
  });

  it('checks fresh external names and canonical accents while allowing the same habit name', async () => {
    const { controller, vault } = createHarness({ now });
    addHabitNote(vault.files, makeHabit({ id: 'one', name: 'Gym' }));
    await controller.load();
    addHabitNote(vault.files, makeHabit({ id: 'two', name: 'Café' }));
    const before = new Map(vault.files);
    expect(await controller.renameHabit('one', 'CAFE\u0301')).toBeNull();
    expect(vault.files).toEqual(before);
    expect((await controller.renameHabit('one', '  GYM  '))?.status).toBe('applied');
    expect(parseHabitNote(vault.files.get('Habits/Gym.md')!).habit.name).toBe('GYM');
  });

  it.each(['create/create', 'rename/rename', 'create/rename'] as const)(
    'serializes simultaneous %s submissions',
    async (scenario) => {
      const { controller, vault } = createHarness({ now });
      addHabitNote(vault.files, makeHabit({ id: 'one', name: 'A' }));
      addHabitNote(vault.files, makeHabit({ id: 'two', name: 'B' }));
      await controller.load();
      const first =
        scenario === 'rename/rename'
          ? controller.renameHabit('one', 'Shared')
          : controller.createHabit('Shared');
      const second =
        scenario === 'create/create'
          ? controller.createHabit('SHARED')
          : controller.renameHabit('two', 'SHARED');
      const results = await Promise.all([first, second]);
      expect(results[0]?.status).toBe('applied');
      expect(results[1]).toBeNull();
      const habits = controller.getViewModel().habits;
      expect(habits.filter((h) => h.name.toLowerCase() === 'shared')).toHaveLength(1);
    },
  );

  it('reports discovery failures without writing and permits a later explicit retry', async () => {
    const { controller, repository, vault } = createHarness({ now });
    await controller.load();
    vi.spyOn(repository, 'discover').mockRejectedValueOnce(new Error('disk unavailable'));
    expect(await controller.createHabit('Reading')).toBeNull();
    expect(vault.files.size).toBe(0);
    expect(controller.getViewModel().message?.text).toContain('disk unavailable');
    expect((await controller.createHabit('Reading'))?.status).toBe('applied');
  });
});
