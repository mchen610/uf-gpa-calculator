import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{html,svelte,ts}', './public/*.html'],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
