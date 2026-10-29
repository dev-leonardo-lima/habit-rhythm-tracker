import { describe, expect, it } from 'vitest';
import { ObsidianVaultPort } from '../../src/storage/obsidian-vault';
import { createFakeApp } from '../helpers/fake-obsidian-app';

describe('Obsidian vault adapter', () => {
  it('lists Markdown files inside a folder and checks existence', async () => {
    const { vault } = createFakeApp();
    await vault.create('Habits/Gym.md', 'a');
    await vault.create('Habits/Read.md', 'b');
    await vault.create('Other/Note.md', 'c');
    const port = new ObsidianVaultPort(vault as never);

    expect(await port.listMarkdownFiles('Habits')).toEqual(['Habits/Gym.md', 'Habits/Read.md']);
    expect(await port.listMarkdownFiles('')).toEqual([
      'Habits/Gym.md',
      'Habits/Read.md',
      'Other/Note.md',
    ]);
    expect(port.exists('Habits/Gym.md')).toBe(true);
    expect(port.exists('Habits/Missing.md')).toBe(false);
  });

  it('reads, creates and processes notes while creating parent folders', async () => {
    const { vault } = createFakeApp();
    const port = new ObsidianVaultPort(vault as never);
    await port.ensureFolder('Nested/Habits');
    expect(vault.folderObjects.has('Nested')).toBe(true);
    expect(vault.folderObjects.has('Nested/Habits')).toBe(true);

    await port.create('Nested/Habits/Gym.md', 'base');
    expect(await port.read('Nested/Habits/Gym.md')).toBe('base');
    expect(await port.process('Nested/Habits/Gym.md', (content) => `${content}+`)).toBe('base+');
    expect(await port.read('Nested/Habits/Gym.md')).toBe('base+');
  });

  it('fails clearly for missing files and conflicting folder paths', async () => {
    const { vault } = createFakeApp();
    const port = new ObsidianVaultPort(vault as never);
    await port.create('Habits.md', 'a file');

    await expect(port.read('Habits/Missing.md')).rejects.toThrow('Habit note not found');
    await expect(port.process('Habits/Missing.md', (value) => value)).rejects.toThrow(
      'Habit note not found',
    );
    await expect(port.ensureFolder('Habits.md')).rejects.toThrow('A file already exists');
    await port.ensureFolder('   ');
  });
});
