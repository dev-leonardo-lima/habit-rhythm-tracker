import { describe, expect, it } from 'vitest';
import { renderHabitNote } from '../../src/storage/habit-note';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

describe('deleting a habit', () => {
  it('preserves existing version-1 notes and unrelated files on cancel and another deletion', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    const existing = makeHabit({ id: 'existing', name: 'Existing', completions: ['2026-10-27'] });
    const oldNote = `---\ntags: [personal]\n---\n${renderHabitNote(existing).replace(
      '"schemaVersion": 1,',
      '"schemaVersion": 1,\n  "custom": "keep",',
    )}\nPersonal notes\n`;
    vault.files.set('Habits/Existing.md', oldNote);
    vault.files.set('Attachments/photo.png', 'attachment');
    const selected = makeHabit({ id: 'selected', name: 'Read', completions: ['2026-10-26'] });
    const selectedPath = addHabitNote(vault.files, selected);
    vault.files.set(selectedPath, `${vault.files.get(selectedPath)}\nSelected personal text`);
    const selectedNote = vault.files.get(selectedPath);
    await controller.load();

    expect(controller.getViewModel().habits).toHaveLength(2);
    expect(vault.files.get('Habits/Existing.md')).toBe(oldNote);
    expect(await controller.prepareDeletion('selected')).toMatchObject({ name: 'Read' });
    controller.cancelDeletion('selected');
    expect(vault.files.get(selectedPath)).toBe(selectedNote);
    expect(vault.files.get('Habits/Existing.md')).toBe(oldNote);

    await controller.prepareDeletion('selected');
    expect((await controller.confirmDeletion('selected'))?.status).toBe('applied');
    expect(vault.files.has(selectedPath)).toBe(false);
    expect(vault.files.get('Habits/Existing.md')).toBe(oldNote);
    expect(vault.files.get('Attachments/photo.png')).toBe('attachment');
    expect(controller.getHabitDetail('selected', 2026)).toBeNull();
    expect(controller.getViewModel().habits.map((habit) => habit.habitId)).toEqual(['existing']);
    controller.previousWeek();
    expect(controller.getViewModel().weeks[0]?.rows.some((row) => row.habitId === 'selected')).toBe(
      false,
    );
    await controller.refresh();
    expect(controller.getViewModel().habits).toHaveLength(1);
  });

  it('uses the Obsidian deletion preference in effect when confirmation runs', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }));
    await controller.load();
    vault.trashDestination = 'system';
    await controller.prepareDeletion('reading');
    vault.trashDestination = 'vault';
    expect((await controller.confirmDeletion('reading'))?.status).toBe('applied');
    expect(vault.systemTrash.size).toBe(0);
    expect(vault.vaultTrash.has('Habits/Read.md')).toBe(true);
  });

  it.each(['active', 'archived', 'pending'] as const)(
    'deletes a %s habit and rediscovers a manually returned note',
    async (state) => {
      const now = state === 'archived' ? localNoon(2026, 11, 2) : localNoon(2026, 10, 28);
      const { vault, controller } = createHarness({ now: () => now });
      const habit = makeHabit({
        id: 'old-id',
        name: 'Read',
        completions: ['2026-10-27'],
        states:
          state === 'active'
            ? [{ week: '2026-10-26', state: 'active' }]
            : [
                { week: '2026-10-26', state: 'active' },
                { week: '2026-11-02', state: 'archived' },
              ],
      });
      const path = addHabitNote(vault.files, habit);
      const original = vault.files.get(path) ?? '';
      await controller.load();
      await controller.prepareDeletion('old-id');
      expect((await controller.confirmDeletion('old-id'))?.status).toBe('applied');
      expect(controller.getViewModel().habits).toHaveLength(0);
      vault.files.set(path, original);
      await controller.refresh();
      expect(controller.getHabitDetail('old-id', 2026)?.habitId).toBe('old-id');
      expect(controller.getHabitDetail('old-id', 2026)?.history.markedDays).toBe(1);
    },
  );

  it('deletes only the selected same-named note and recreates a fresh habit', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    const first = makeHabit({ id: 'first', name: 'Read', completions: ['2026-10-27'] });
    const second = makeHabit({ id: 'second', name: 'Read' });
    addHabitNote(vault.files, first, 'Habits/Read.md');
    const otherPath = addHabitNote(vault.files, second, 'Habits/Read 2.md');
    const other = vault.files.get(otherPath);
    await controller.load();
    await controller.prepareDeletion('first');
    await controller.confirmDeletion('first');
    expect(vault.files.get(otherPath)).toBe(other);
    expect(await controller.createHabit('Read')).toBeNull();
    expect(controller.getViewModel().habits).toHaveLength(1);
    await controller.renameHabit('second', 'Books');
    await controller.createHabit('Read');
    const created = controller.getViewModel().habits.find((habit) => habit.habitId !== 'second');
    expect(created?.habitId).not.toBe('first');
    expect(controller.getHabitDetail(created?.habitId ?? '', 2026)?.history.markedDays).toBe(0);
  });
});
