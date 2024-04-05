import { Grid } from './grid'
import { EventListeners } from './eventListeners'
import { State } from './state'

const $expand = document.getElementById('expand')
const $footer = document.getElementById('footer')
const $id = document.getElementById('id')
const $reset = document.getElementById('reset')
const $score = document.getElementById('score')
const $swaps = document.getElementById('swaps')
const $words = document.getElementById('words')

const location = window.location
const params = new URLSearchParams(location.search)

export class Game {
  #eventListeners = new EventListeners({ context: this })
  #grid

  constructor () {
    let id = params.get(Game.Params.id) ?? Game.defaultId()
    const date = Date.parse(id)
    if (!isNaN(date) && date > Game.today) {
      console.debug(`Defaulting to current day puzzle given ID in the future: ${id}`)
      id = Game.defaultId()
    }

    this.#grid = new Grid(id, params.get(Game.Params.width))

    $id.href = `?id=${id}`
    $id.textContent = id

    this.#eventListeners.add([
      { type: 'click', element: $reset, handler: this.reset },
      { type: Grid.Events.Update, handler: this.update }
    ])

    this.update()
  }

  reset () {
    this.#grid.reset()
    this.update()
  }

  update () {
    const words = this.#grid.getWords()

    this.#updateScore(words)
    this.#updateSwaps()
    this.#updateWords(words)
  }

  #updateScore (words) {
    $score.textContent = words.reduce((points, word) => points + word.points, 0)
  }

  #updateSwaps () {
    const swaps = this.#grid.getSwaps()

    $swaps.classList.toggle('empty', swaps.length === 0)
    $swaps.replaceChildren(...swaps.map((swap) => {
      const $element = document.createElement('li')
      $element.textContent = swap.join(' → ')
      return $element
    }))
  }

  #updateWords (words) {
    $words.classList.toggle('empty', words.length === 0)
    $words.replaceChildren(...words.map((word) => {
      const $element = document.createElement('li')
      $element.textContent = `${word.content} (${word.points})`
      return $element
    }))
  }

  static defaultId () {
    // The ID for the daily puzzle
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  static today = Date.parse(Game.defaultId())

  static Params = Object.freeze({
    expanded: 'expanded',
    id: 'id',
    seed: 'seed',
    state: 'state',
    width: 'width'
  })
}

const expanded = State.get(Game.Params.expanded)
if (expanded || [Game.Params.expanded, Game.Params.state].some((param) => params.has(param))) {
  $expand.textContent = 'expand_more'
  $footer.classList.add(Game.Params.expanded)
}

$expand.addEventListener('click', () => {
  $footer.classList.toggle(Game.Params.expanded)
  const expanded = $footer.classList.contains(Game.Params.expanded)
  $expand.textContent = expanded ? 'expand_more' : 'expand_less'
  State.set(Game.Params.expanded, expanded)
})
