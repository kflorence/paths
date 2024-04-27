import { Game } from './components/game'
import './components/help'

if (process.env.NODE_ENV === 'production') {
  require('./components/analytics')
}

const game = new Game()
game.setup()

window.addEventListener('popstate', (event) => {
  // Handle user navigating through history
  window.location.reload()
})

window.game = game
