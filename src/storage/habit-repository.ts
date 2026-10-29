import { t } from '../i18n';
import type { DiscoveryResult, DiscoveredHabit, Habit, NoteIssue } from '../domain/types';
import { HabitNoteError, parseHabitNote } from './habit-note';
import type { VaultPort } from './vault-port';

const MAX_PATH_ATTEMPTS = 10_000;

export function normalizeFolder(folder: string): string {
  return folder
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

export function isPathInFolder(path: string, folder: string): boolean {
  const normalized = normalizeFolder(folder);
  if (!normalized) {
    return path.endsWith('.md');
  }
  return path.startsWith(`${normalized}/`);
}

export function sanitizeHabitFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 100)
    .trim();
  return cleaned.length > 0 ? cleaned : 'Habit';
}

export class HabitRepository {
  constructor(
    private readonly vault: VaultPort,
    private readonly habitsFolder: string,
  ) {}

  candidatePath(name: string): string {
    const folder = normalizeFolder(this.habitsFolder);
    const fileName = `${sanitizeHabitFileName(name)}.md`;
    return folder ? `${folder}/${fileName}` : fileName;
  }

  async findAvailablePath(name: string): Promise<string> {
    const base = this.candidatePath(name);
    if (!this.vault.exists(base)) {
      return base;
    }
    const stem = base.replace(/\.md$/, '');
    for (let counter = 2; counter < MAX_PATH_ATTEMPTS; counter += 1) {
      const candidate = `${stem} ${counter}.md`;
      if (!this.vault.exists(candidate)) {
        return candidate;
      }
    }
    throw new Error(t('repository.noAvailablePath', { name }));
  }

  async discover(): Promise<DiscoveryResult> {
    const paths = await this.vault.listMarkdownFiles(normalizeFolder(this.habitsFolder));
    const habits: DiscoveredHabit[] = [];
    const issues: NoteIssue[] = [];

    for (const path of paths) {
      try {
        const content = await this.vault.read(path);
        const parsed = parseHabitNote(content);
        habits.push({ path, content, habit: parsed.habit });
      } catch (error) {
        issues.push(toIssue(path, error));
      }
    }

    const byId = new Map<string, DiscoveredHabit[]>();
    for (const discovered of habits) {
      const group = byId.get(discovered.habit.id);
      if (group) {
        group.push(discovered);
      } else {
        byId.set(discovered.habit.id, [discovered]);
      }
    }

    const duplicates = new Set<string>();
    for (const [id, group] of byId) {
      if (group.length > 1) {
        duplicates.add(id);
        for (const discovered of group) {
          issues.push({
            path: discovered.path,
            code: 'duplicate-id',
            message: t('repository.duplicateId', { id }),
          });
        }
      }
    }

    return {
      habits: habits
        .filter((discovered) => !duplicates.has(discovered.habit.id))
        .sort((left, right) => left.path.localeCompare(right.path)),
      issues: issues.sort((left, right) => left.path.localeCompare(right.path)),
    };
  }

  async loadByPath(path: string): Promise<DiscoveredHabit> {
    const content = await this.vault.read(path);
    const parsed = parseHabitNote(content);
    return { path, content, habit: parsed.habit };
  }

  async findById(id: string): Promise<DiscoveredHabit | null> {
    const result = await this.discover();
    return result.habits.find((discovered) => discovered.habit.id === id) ?? null;
  }
}

export function toIssue(path: string, error: unknown): NoteIssue {
  if (error instanceof HabitNoteError) {
    return { path, code: error.code, message: error.message };
  }
  return {
    path,
    code: 'read-failed',
    message: error instanceof Error ? error.message : t('repository.unknownError'),
  };
}

export type { Habit };
