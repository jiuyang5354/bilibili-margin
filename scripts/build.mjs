import { build } from 'vite';
import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite';
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
    plugins: [wgslVitePlugin({ minify: { whitespace: true } })],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      target: 'chrome110',
      minify: true,
      lib: { entry, name: `margin_${name}`, formats: ['iife'], fileName: () => `${name}.js` },
    },
  });
}

// 流光（WebGPU / vgpu，约 200KB）单独打包，只有用户选到这款背景时才由内容脚本动态 import
await build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  plugins: [wgslVitePlugin({ minify: { whitespace: true } })],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome113',
    minify: true,
    lib: { entry: 'src/content/bg/flux/index.ts', formats: ['es'], fileName: () => 'flux.js' },
    rolldownOptions: { output: { minify: true } },
  },
});

await cp('public', 'dist', { recursive: true });
console.log('built → dist/');
