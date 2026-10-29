import esbuild from 'esbuild';
import process from 'node:process';

const production = process.argv.includes('production');
const watch = process.argv.includes('--watch');

const context = await esbuild.context({
  banner: {
    js: '/* Habit Rhythm Tracker - bundled output. Do not edit directly. */',
  },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
  ],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: production,
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
