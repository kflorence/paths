import { Game } from './components/game'
import { State } from './components/state'

const state = new State()
const game = new Game(state)

window.game = game
