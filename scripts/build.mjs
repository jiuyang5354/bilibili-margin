import { build } from 'vite';
import { cp, rm, mkdir } from 'node:fs/promises';

const entries = [
  { name: 'content', entry: 'src/content/main.ts' },
  { name: 'popup', entry: 'src/popup/popup.ts' },
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

for (const { name, entry } of entries) {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      target: 'chrome110',
      minify: true,
      lib: { entry, name: `margin_${name}`, formats: ['iife'], fileName: () => `${name}.js` },
    },
  });
}

await cp('public', 'dist', { recursive: true });
console.log('built → dist/');
