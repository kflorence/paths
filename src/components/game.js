import { Grid } from './grid'
import { EventListeners } from './eventListeners'
import { State } from './state'
import { Word } from './word'

const $expand = document.getElementById('expand')
const $footer = document.getElementById('footer')
const $id = document.getElementById('id')
const $reset = document.getElementById('reset')
const $score = document.getElementById('score')
const $selection = document.getElementById('selection')
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
      { type: 'click', element: $swaps, handler: this.#deleteSwap },
      { type: 'click', element: $words, handler: this.#deleteWord },
      { type: Grid.Events.Update, handler: this.update }
    ])

    this.update()
  }

  reset () {
    this.#grid.reset()
    this.update()
  }

  update (event) {
    const detail = event?.detail ?? {}

    const words = detail.words ?? []
    if (words.length) {
      this.#updateScore(words)
      this.#updateWords(words)
    }

    this.#updateSwaps()
    this.#updateSelection(detail.selection ?? [])
  }

  #deleteSwap (event) {
    if (event.target.classList.contains('delete')) {
      this.#grid.removeSwap(event.target.dataset.index)
      this.update()
    }
  }

  #deleteWord (event) {
    if (event.target.classList.contains('delete')) {
      const words = this.#grid.removeWord(event.target.dataset.index)
      this.#updateWords(words)
    }
  }

  #updateScore (words) {
    $score.textContent = words.reduce((points, word) => points + word.points, 0)
  }

  #updateSelection (selection) {
    $selection.replaceChildren()
    $selection.classList.remove(Grid.ClassNames.Valid)

    if (!selection.length) {
      return
    }

    const $content = document.createElement('span')
    $content.textContent = Grid.getContent(selection)

    const children = [$content]
    if (Word.isValid($content.textContent)) {
      $content.classList.add(Grid.ClassNames.Valid)
    } else {
      const content = Grid.getContent(selection.reverse())
      if (Word.isValid(content)) {
        $content.classList.add(Grid.ClassNames.Valid)
        $content.textContent = content
      }
    }

    if ($content.classList.contains(Grid.ClassNames.Valid)) {
      const word = new Word(selection)
      const $points = document.createElement('span')
      $points.classList.add('points')
      $points.textContent = word.points
      children.push($points)
    }

    $selection.replaceChildren(...children)
  }

  #updateSwaps () {
    const swaps = this.#grid.getSwaps()

    $swaps.classList.toggle('empty', swaps.length === 0)
    $swaps.replaceChildren(...swaps.map((swap, index) => {
      const $element = document.createElement('li')

      const elements = Game.getContainerElements()
      $element.append(elements.$container)

      const $swap = document.createElement('span')
      $swap.classList.add('swap')
      $swap.textContent = `${index + 1}. ${swap.join(' → ')}`
      elements.$left.append($swap)

      elements.$right.append(Game.getDeleteElement(index))

      return $element
    }))
  }

  #updateWords (words) {
    $words.classList.toggle('empty', words.length === 0)
    $words.replaceChildren(...words.map((word, index) => {
      const $element = document.createElement('li')

      const elements = Game.getContainerElements()
      $element.append(elements.$container)

      const $word = document.createElement('span')
      $word.classList.add('word')
      $word.textContent = `${index + 1}. ${word.content} (${word.points})`
      elements.$left.append($word)

      elements.$right.append(Game.getDeleteElement(index))

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

  static getContainerElements () {
    const $container = document.createElement('div')
    $container.classList.add('container')

    const $left = document.createElement('div')
    $left.classList.add('flex-left')
    $container.append($left)

    const $right = document.createElement('div')
    $right.classList.add('flex-right')
    $container.append($right)

    return { $container, $left, $right }
  }

  static getDeleteElement (index) {
    const $delete = document.createElement('span')
    $delete.classList.add('delete', 'material-symbols-outlined')
    $delete.dataset.index = index.toString()
    $delete.textContent = 'delete'
    $delete.title = 'Delete'

    return $delete
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
