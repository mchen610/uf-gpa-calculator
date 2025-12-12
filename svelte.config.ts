import preprocess from 'svelte-preprocess'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const config = {
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
