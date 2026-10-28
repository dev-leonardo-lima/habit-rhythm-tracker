import type { App } from 'obsidian';
import type { EditorGuard, EditorInspection } from '../storage/guarded-write';

interface EditorBuffer {
  getValue(): string;
}

interface MarkdownLeafView {
  file?: { path: string } | null;
  editor?: EditorBuffer | null;
}

/**
 * Compares open Markdown editor buffers with each other. The guarded writer then
 * compares the buffer with the saved base snapshot. Any unverifiable state blocks.
 */
export class ObsidianEditorGuard implements EditorGuard {
  constructor(private readonly app: App) {}

  async inspect(path: string): Promise<EditorInspection> {
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    let buffer: string | undefined;
    for (const leaf of leaves) {
      const view = leaf.view as unknown as MarkdownLeafView | null;
      if (!view) {
        return { status: 'unknown' };
      }
      if (!view.file || typeof view.file.path !== 'string' || view.file.path.length === 0) {
        return { status: 'unknown' };
      }
      if (view.file.path !== path) {
        continue;
      }
      if (!view.editor || typeof view.editor.getValue !== 'function') {
        return { status: 'unknown' };
      }
      let value: string;
      try {
        value = view.editor.getValue();
      } catch {
        return { status: 'unknown' };
      }
      if (typeof value !== 'string') {
        return { status: 'unknown' };
      }
      if (buffer !== undefined && buffer !== value) {
        return { status: 'unknown' };
      }
      buffer = value;
    }
    if (buffer === undefined) {
      return { status: 'none' };
    }
    return { status: 'clean', content: buffer };
  }
}
