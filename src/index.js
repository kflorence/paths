import { Game } from './components/game'
import './components/help'

if (process.env.NODE_ENV === 'production') {
  require('./components/analytics')
}

window.game = new Game()
