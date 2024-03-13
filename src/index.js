import { Game } from './components/game'
import { State } from './components/state'

const crypto = window.crypto
const $new = document.getElementById('new')
$new.href = `?id=${crypto.randomUUID().split('-')[0]}`

const state = new State()
const game = new Game(state)

window.game = game
