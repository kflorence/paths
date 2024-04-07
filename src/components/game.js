import { Grid } from './grid'
import { EventListeners } from './eventListeners'
import { State } from './state'
import { Word } from './word'

const $expand = document.getElementById('expand')
const $footer = document.getElementById('footer')
const $includeState = document.getElementById('include-state')
const $new = document.getElementById('new')
const $path = document.getElementById('path')
const $reset = document.getElementById('reset')
const $score = document.getElementById('score')
const $selection = document.getElementById('selection')
const $share = document.getElementById('share')
const $swaps = document.getElementById('swaps')
const $width = document.getElementById('width')
const $words = document.getElementById('words')

const crypto = window.crypto
const location = window.location
const params = new URLSearchParams(location.search)

export class Game {
  #eventListeners = new EventListeners({ context: this })
  #grid
  #state

  constructor () {
    let path = params.get(Game.Params.Path) ?? Game.defaultId()
    const date = Date.parse(path)
    if (!isNaN(date) && date > Game.today) {
      console.debug(`Defaulting to current day puzzle given path in the future: ${path}`)
      path = Game.defaultId()
    }

    $new.href = `?${Game.Params.Path}=${crypto.randomUUID().split('-')[0]}`
    $path.href = `?${Game.Params.Path}=${path}`
    $path.textContent = path

    this.#grid = new Grid(path, State.params.get(Game.Params.Width))
    this.#state = new State(Game.Params.Game, {}, [Game.Params.Expand])

    const state = new Game.State(this.#state.get())

    if (state.expand) {
      $expand.textContent = 'expand_less'
      $footer.classList.add(Game.ClassNames.Expanded)
    }

    if (state.includeStateInShareUrl) {
      $includeState.checked = true
    }

    this.#state.set(state)

    this.#eventListeners.add([
      { type: 'change', element: $includeState, handler: this.#onIncludeStateChange },
      { type: 'change', element: $width, handler: this.#onWidthChange },
      { type: 'click', element: $expand, handler: this.expand },
      { type: 'click', element: $reset, handler: this.reset },
      { type: 'click', element: $share, handler: this.share },
      { type: 'click', element: $swaps, handler: this.#deleteSwap },
      { type: 'click', element: $words, handler: this.#deleteWord },
      { type: Grid.Events.Update, handler: this.update }
    ])

    const detail = { swaps: this.#grid.getSwaps(), words: this.#grid.getWords() }
    this.update({ detail })
    this.#updateWidthSelector()
  }

  expand () {
    const expanded = !this.#state.get(Game.Params.Expand)
    $footer.classList.toggle(Game.ClassNames.Expanded, expanded)
    $expand.textContent = expanded ? 'expand_less' : 'expand_more'
    this.#state.set(Game.Params.Expand, expanded)
  }

  reset () {
    this.#grid.reset()
    this.update()
  }

  share (event) {
    // TODO
  }

  update (event) {
    const detail = event?.detail ?? {}

    const words = detail.words ?? []
    if (words.length) {
      this.#updateScore(words)
      this.#updateWords(words)
    }

    const swaps = detail.swaps ?? []
    if (swaps.length) {
      this.#updateSwaps(swaps)
    }

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

  #onIncludeStateChange (event) {
    const state = this.#state.get()
    state.includeStateInShareUrl = event.target.checked
    this.#state.set(state)
  }

  #onWidthChange (event) {
    State.params.set(Game.Params.Width, event.target.value)
    location.assign(State.url.search)
  }

  #updateScore (words) {
    $score.textContent = words.reduce((points, word) => points + word.points, 0)
  }

  #updateSelection (selection) {
    $selection.replaceChildren()
    $selection.classList.remove(Game.ClassNames.Valid)

    if (!selection.length) {
      return
    }

    const $content = document.createElement('span')
    $content.textContent = Grid.getContent(selection)

    const children = [$content]
    if (Word.isValid($content.textContent)) {
      $content.classList.add(Game.ClassNames.Valid)
    } else {
      const content = Grid.getContent(selection.reverse())
      if (Word.isValid(content)) {
        $content.classList.add(Game.ClassNames.Valid)
        $content.textContent = content
      }
    }

    if ($content.classList.contains(Game.ClassNames.Valid)) {
      const word = new Word(selection)
      const $points = document.createElement('span')
      $points.classList.add(Game.ClassNames.Points)
      $points.textContent = word.points
      children.push($points)
    }

    $selection.replaceChildren(...children)
  }

  #updateSwaps (swaps) {
    $swaps.replaceChildren(...swaps.map((swap, index) => {
      const $element = document.createElement('li')

      const elements = Game.getContainerElements()
      $element.append(elements.$container)

      const $swap = document.createElement('span')
      $swap.classList.add(Game.ClassNames.Swap)
      $swap.textContent = `${index + 1}. ${swap.join(' → ')}`
      elements.$left.append($swap)

      elements.$right.append(Game.getDeleteElement(index))

      return $element
    }))
  }

  #updateWidthSelector () {
    $width.replaceChildren(...Grid.Widths.map((width) => {
      const $option = document.createElement('option')
      $option.textContent = `${width}x${width}`
      $option.value = width.toString()
      if (width === this.#grid.width) {
        $option.selected = true
      }
      return $option
    }))
  }

  #updateWords (words) {
    $words.replaceChildren(...words.map((word, index) => {
      const $element = document.createElement('li')

      const elements = Game.getContainerElements()
      $element.append(elements.$container)

      const $word = document.createElement('span')
      $word.classList.add(Game.ClassNames.Word)
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
    $container.classList.add(Game.ClassNames.Container)

    const $left = document.createElement('div')
    $left.classList.add(Game.ClassNames.FlexLeft)
    $container.append($left)

    const $right = document.createElement('div')
    $right.classList.add(Game.ClassNames.FlexRight)
    $container.append($right)

    return { $container, $left, $right }
  }

  static getDeleteElement (index) {
    const $delete = document.createElement('span')
    $delete.classList.add(Game.ClassNames.Delete, Game.ClassNames.Icon)
    $delete.dataset.index = index.toString()
    $delete.textContent = 'delete'
    $delete.title = 'Delete'

    return $delete
  }

  static today = Date.parse(Game.defaultId())

  static ClassNames = Object.freeze({
    Container: 'container',
    Delete: 'delete',
    Expanded: 'expanded',
    FlexLeft: 'flex-left',
    FlexRight: 'flex-right',
    Icon: 'material-symbols-outlined',
    Points: 'points',
    Swap: 'swap',
    Valid: 'valid',
    Word: 'word'
  })

  static Params = Object.freeze({
    Expand: 'expand',
    Game: 'game',
    Path: 'path',
    Width: 'width'
  })

  static State = class {
    includeStateInShareUrl
    expand

    constructor (state) {
      this.expand = state.expand === true
      this.includeStateInShareUrl = state.includeStateInShareUrl === true
    }
  }
}
