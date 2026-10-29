export type {
  DiscoveryResult,
  DiscoveredHabit,
  Habit,
  LocalDate,
  NoteIssue,
} from '../domain/types';

/**
 * Minimal vault surface used by the plugin storage layer. The Obsidian adapter
 * implements this interface with supported cross-platform Vault APIs.
 */
export interface VaultPort {
  /** Returns Markdown file paths inside the given folder (or all when empty). */
  listMarkdownFiles(folder: string): Promise<string[]>;
  exists(path: string): boolean;
  read(path: string): Promise<string>;
  create(path: string, content: string): Promise<void>;
  /** Protected read-modify-write, mirroring Obsidian's `Vault.process`. */
  process(path: string, transform: (content: string) => string): Promise<string>;
  ensureFolder(path: string): Promise<void>;
}
