import { describe, expect, it } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import { ObsidianEditorGuard } from '../../src/ui/obsidian-editor-guard';

function appWithLeaves(
  leaves: Array<{ file: { path: string } | null; editor: unknown } | null>,
): App {
  return {
    workspace: {
      getLeavesOfType() {
        return leaves.map((leaf) => ({ view: leaf }) as unknown as WorkspaceLeaf);
      },
    },
  } as unknown as App;
}

describe('Obsidian editor guard', () => {
  it('reports no open editor for unrelated or absent leaves', async () => {
    const guard = new ObsidianEditorGuard(appWithLeaves([]));
    expect(await guard.inspect('Habits/Gym.md')).toEqual({ status: 'none' });

    const unrelated = new ObsidianEditorGuard(
      appWithLeaves([{ file: { path: 'Other.md' }, editor: { getValue: () => 'x' } }]),
    );
    expect(await unrelated.inspect('Habits/Gym.md')).toEqual({ status: 'none' });
  });

  it('returns the buffer when all open copies agree', async () => {
    const guard = new ObsidianEditorGuard(
      appWithLeaves([
        { file: { path: 'Habits/Gym.md' }, editor: { getValue: () => 'content' } },
        { file: { path: 'Habits/Gym.md' }, editor: { getValue: () => 'content' } },
      ]),
    );
    expect(await guard.inspect('Habits/Gym.md')).toEqual({
      status: 'clean',
      content: 'content',
    });
  });

  it('fails closed for unidentified leaves and missing views', async () => {
    const missingView = new ObsidianEditorGuard(appWithLeaves([null]));
    expect(await missingView.inspect('Habits/Gym.md')).toEqual({ status: 'unknown' });

    const missingFile = new ObsidianEditorGuard(appWithLeaves([{ file: null, editor: null }]));
    expect(await missingFile.inspect('Habits/Gym.md')).toEqual({ status: 'unknown' });

    const emptyPath = new ObsidianEditorGuard(
      appWithLeaves([{ file: { path: '' }, editor: null }]),
    );
    expect(await emptyPath.inspect('Habits/Gym.md')).toEqual({ status: 'unknown' });

    const mixed = new ObsidianEditorGuard(
      appWithLeaves([
        { file: { path: 'Habits/Gym.md' }, editor: { getValue: () => 'content' } },
        null,
      ]),
    );
    expect(await mixed.inspect('Habits/Gym.md')).toEqual({ status: 'unknown' });
  });

  it('ignores an unrelated deferred note using its saved leaf state', async () => {
    const leaf = {
      view: {},
      isDeferred: true,
      getViewState: () => ({ type: 'markdown', state: { file: 'Other.md' } }),
      loadIfDeferred: async () => {
        throw new Error('unrelated notes should not be loaded');
      },
    };
    const app = { workspace: { getLeavesOfType: () => [leaf] } } as unknown as App;
    const guard = new ObsidianEditorGuard(app);
    await guard.prepare('Habits/Gym.md');
    expect(guard.inspect('Habits/Gym.md')).toEqual({ status: 'none' });
    leaf.view = null as unknown as object;
    expect(guard.inspect('Habits/Gym.md')).toEqual({ status: 'none' });
  });

  it('loads a deferred target note before checking its editor', async () => {
    const leaf = {
      view: {} as unknown,
      isDeferred: true,
      getViewState: () => ({ type: 'markdown', state: { file: 'Habits/Gym.md' } }),
      async loadIfDeferred() {
        this.view = { file: { path: 'Habits/Gym.md' }, editor: { getValue: () => 'content' } };
        this.isDeferred = false;
      },
    };
    const app = { workspace: { getLeavesOfType: () => [leaf] } } as unknown as App;
    const guard = new ObsidianEditorGuard(app);
    await guard.prepare('Habits/Gym.md');
    expect(guard.inspect('Habits/Gym.md')).toEqual({ status: 'clean', content: 'content' });
  });

  it('fails closed for unknown, missing, throwing or disagreeing editors', async () => {
    const unknown = new ObsidianEditorGuard(
      appWithLeaves([{ file: { path: 'Habits/Gym.md' }, editor: null }]),
    );
    expect(await unknown.inspect('Habits/Gym.md')).toEqual({ status: 'unknown' });

    const throwing = new ObsidianEditorGuard(
      appWithLeaves([
        {
          file: { path: 'Habits/Gym.md' },
          editor: {
            getValue: () => {
              throw new Error('editor unavailable');
            },
          },
        },
      ]),
    );
    expect(await throwing.inspect('Habits/Gym.md')).toEqual({ status: 'unknown' });

    const nonString = new ObsidianEditorGuard(
      appWithLeaves([
        { file: { path: 'Habits/Gym.md' }, editor: { getValue: () => 42 as unknown as string } },
      ]),
    );
    expect(await nonString.inspect('Habits/Gym.md')).toEqual({ status: 'unknown' });

    const disagreeing = new ObsidianEditorGuard(
      appWithLeaves([
        { file: { path: 'Habits/Gym.md' }, editor: { getValue: () => 'a' } },
        { file: { path: 'Habits/Gym.md' }, editor: { getValue: () => 'b' } },
      ]),
    );
    expect(await disagreeing.inspect('Habits/Gym.md')).toEqual({ status: 'unknown' });
  });
});
