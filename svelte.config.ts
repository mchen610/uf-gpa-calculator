import preprocess from 'svelte-preprocess'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte'

const config: SvelteConfig = {
  preprocess: preprocess({
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
    typescript: true,
  }),
  compilerOptions: {
    dev: false,
  },
}

export default config
