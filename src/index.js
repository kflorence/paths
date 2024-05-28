import { debug } from './components/debug'
import { Game } from './components/game'
import './components/info'

if (process.env.NODE_ENV === 'production') {
  require('./components/analytics')
}

const game = new Game()
game.setup()

window.addEventListener('popstate', () => {
  // Handle user navigating through history
  window.location.reload()
})

window.debug = debug
window.game = game
