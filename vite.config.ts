import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { crx } from '@crxjs/vite-plugin'
import checker from 'vite-plugin-checker'
import zipPack from 'vite-plugin-zip-pack'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import svelteConfig from './svelte.config'
import manifest from './src/manifest.json'

const currentDir = fileURLToPath(new URL('.', import.meta.url))
const rootDir = path.resolve(currentDir, 'src')

export default defineConfig({
  root: rootDir,
  publicDir: path.resolve(currentDir, 'public'),
  plugins: [
    svelte({
      ...svelteConfig,
      inspector: true,
    }),
    crx({ manifest }),
    checker({
      typescript: true,
    }),
    zipPack({
      outDir: currentDir,
      outFileName: 'extension.zip',
    }),
  ],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  build: {
    outDir: path.resolve(currentDir, 'dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      $shared: path.resolve(rootDir, 'shared'),
    },
  },
})
