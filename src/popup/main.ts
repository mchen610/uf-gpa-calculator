import '../app.css'
import App from './App.svelte'

const target = document.getElementById('app')

if (!target) {
  throw new Error('one.uf gpa calculator: failed to find mount element')
}

export const app = new App({
  target,
})

export default app
