import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { crx } from '@crxjs/vite-plugin'
import checker from 'vite-plugin-checker'
import zipPack from 'vite-plugin-zip-pack'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import svelteConfig from './svelte.config'
import manifest from './src/manifest.json'

export default defineConfig({
  plugins: [
    svelte({ ...svelteConfig, inspector: true }),
    crx({ manifest }),
    checker({ typescript: true }),
    zipPack({ outFileName: 'extension.zip' }),
  ],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  resolve: {
    alias: {
      $shared: '/src/shared',
    },
  },
})
