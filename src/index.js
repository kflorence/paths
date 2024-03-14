import { Game } from './components/game'

const crypto = window.crypto
const $new = document.getElementById('new')
$new.href = `?id=${crypto.randomUUID().split('-')[0]}`

window.game = new Game()
