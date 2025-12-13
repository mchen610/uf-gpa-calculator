import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { crx } from '@crxjs/vite-plugin'
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
  plugins: [svelte(svelteConfig), crx({ manifest })],
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
