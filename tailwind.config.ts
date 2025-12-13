import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{html,svelte,ts}', './public/*.html'],
  theme: {
    extend: {
      fontSize: {
        xxs: '10px',
      },
    },
  },
  plugins: [],
}

export default config
