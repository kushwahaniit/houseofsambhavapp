import * as esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: 'dist/server.js',
    format: 'esm',
    external: [
      'express',
      'vite',
      'path',
      'url',
      'dotenv',
      'firebase',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'fsevents'
    ],
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });
  console.log('Server build complete');
}

build().catch((err) => {
  console.error('Server build failed:', err);
  process.exit(1);
});
