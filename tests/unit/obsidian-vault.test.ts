import { describe, expect, it, vi } from 'vitest';
import { ObsidianVaultPort } from '../../src/storage/obsidian-vault';
import { createFakeApp } from '../helpers/fake-obsidian-app';

describe('Obsidian vault adapter', () => {
  it('lists Markdown files inside a folder and checks existence', async () => {
    const { vault, app } = createFakeApp();
    await vault.create('Habits/Gym.md', 'a');
    await vault.create('Habits/Read.md', 'b');
    await vault.create('Habits/Nested/Meditate.md', 'nested');
    await vault.create('Habits/image.png', 'not a note');
    await vault.create('Other/Note.md', 'c');
    const port = new ObsidianVaultPort(vault as never, app.fileManager);
    const enumerate = vi.spyOn(vault, 'getMarkdownFiles');

    expect(await port.listMarkdownFiles('Habits')).toEqual([
      'Habits/Gym.md',
      'Habits/Nested/Meditate.md',
      'Habits/Read.md',
    ]);
    expect(await port.listMarkdownFiles('')).toEqual([
      'Habits/Gym.md',
      'Habits/Nested/Meditate.md',
      'Habits/Read.md',
      'Other/Note.md',
    ]);
    expect(await port.listMarkdownFiles('Missing')).toEqual([]);
    expect(await port.listMarkdownFiles('Habits/Gym.md')).toEqual([]);
    expect(enumerate).not.toHaveBeenCalled();
    expect(port.exists('Habits/Gym.md')).toBe(true);
    expect(port.exists('Habits/Missing.md')).toBe(false);
  });

  it('reads, creates and processes notes while creating parent folders', async () => {
    const { vault, app } = createFakeApp();
    const port = new ObsidianVaultPort(vault as never, app.fileManager);
    await port.ensureFolder('Nested/Habits');
    expect(vault.folderObjects.has('Nested')).toBe(true);
    expect(vault.folderObjects.has('Nested/Habits')).toBe(true);

    await port.create('Nested/Habits/Gym.md', 'base');
    expect(await port.read('Nested/Habits/Gym.md')).toBe('base');
    expect(await port.process('Nested/Habits/Gym.md', (content) => `${content}+`)).toBe('base+');
    expect(await port.read('Nested/Habits/Gym.md')).toBe('base+');
  });

  it('fails clearly for missing files and conflicting folder paths', async () => {
    const { vault, app } = createFakeApp();
    const port = new ObsidianVaultPort(vault as never, app.fileManager);
    await port.create('Habits.md', 'a file');

    await expect(port.read('Habits/Missing.md')).rejects.toThrow('Habit note not found');
    await expect(port.process('Habits/Missing.md', (value) => value)).rejects.toThrow(
      'Habit note not found',
    );
    await expect(port.ensureFolder('Habits.md')).rejects.toThrow('A file already exists');
    await port.ensureFolder('   ');
  });

  it('delegates exactly one validated file to the file manager and preserves its result', async () => {
    const { vault } = createFakeApp();
    const file = await vault.create('Habits/Gym.md', 'complete note');
    const manager = { trashFile: vi.fn().mockResolvedValue(false) };
    const port = new ObsidianVaultPort(vault as never, manager as never);
    const directDelete = vi.spyOn(vault, 'delete');

    expect(await port.trash('Habits/Gym.md')).toBe(false);
    expect(manager.trashFile).toHaveBeenCalledOnce();
    expect(manager.trashFile).toHaveBeenCalledWith(file);
    expect(directDelete).not.toHaveBeenCalled();
  });

  it('refuses to pass a missing path or folder to the file manager', async () => {
    const { vault } = createFakeApp();
    await vault.createFolder('Habits');
    const manager = { trashFile: vi.fn() };
    const port = new ObsidianVaultPort(vault as never, manager as never);

    await expect(port.trash('Habits')).rejects.toThrow('Habit note not found');
    await expect(port.trash('Habits/Missing.md')).rejects.toThrow('Habit note not found');
    expect(manager.trashFile).not.toHaveBeenCalled();
  });
});
