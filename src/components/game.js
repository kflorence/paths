import { Grid } from './grid'
import { EventListeners } from './eventListeners'
import Tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { State } from './state'
import { Word } from './word'
import { writeToClipboard } from './util'

const $expand = document.getElementById('expand')
const $footer = document.getElementById('footer')
const $includeState = document.getElementById('include-state')
const $new = document.getElementById('new')
const $path = document.getElementById('path')
const $reset = document.getElementById('reset')
const $score = document.getElementById('score')
const $selection = document.getElementById('selection')
const $share = document.getElementById('share')
const $statistics = document.getElementById('statistics')
const $swaps = document.getElementById('swaps')
const $width = document.getElementById('width')
const $words = document.getElementById('words')

const crypto = window.crypto
const tippy = Tippy($share, { content: 'Copied!', theme: 'custom', trigger: 'manual' })

if (State.params.has(State.Params.State)) {
  document.body.classList.add('share')
}

export class Game {
  #eventListeners = new EventListeners({ context: this })
  #grid
  #state

  constructor () {
    this.#grid = new Grid()

    $new.href = `?${State.Params.Id}=${crypto.randomUUID().split('-')[0]}`
    $path.href = `?${State.Params.Id}=${this.#grid.id}`
    $path.textContent = this.#grid.id

    this.#state = new State('game', {}, [State.Params.Expand])

    this.#eventListeners.add([
      { type: 'change', element: $includeState, handler: this.#onIncludeStateChange },
      { type: 'change', element: $width, handler: this.#onWidthChange },
      { type: 'click', element: $expand, handler: this.#onExpand },
      { type: 'click', element: $reset, handler: this.reset },
      { type: 'click', element: $share, handler: this.share },
      { type: 'click', element: $swaps, handler: this.#deleteSwap },
      { type: 'click', element: $words, handler: this.#deleteWord },
      { type: Grid.Events.Selection, handler: this.#updateSelection },
      { type: Grid.Events.Update, handler: this.#onGridUpdate }
    ])

    this.update()
    this.#updateDrawer()
    this.#updateWidthSelector()
  }

  getScore (words, statistics = this.#grid.getStatistics()) {
    let score = words.reduce((points, word) => points + word.points, 0)
    if (statistics.progress === 100) {
      score += this.#grid.size
    }
    return score
  }

  reset () {
    this.#grid.reset()
    this.update()
  }

  async share () {
    const id = this.#grid.id
    const width = this.#grid.width
    const size = `${width}x${width}`
    const state = this.#state.get()
    const url = new URL(State.url.toString())
    const words = this.#grid.getWords()
    const statistics = this.#grid.getStatistics()
    const score = this.getScore(words, statistics)

    url.searchParams.set(State.Params.Id, id)
    if (state.includeStateInShareUrl) {
      url.searchParams.set(State.Params.State, this.#grid.getState())
    }

    const content = `Paths #${id} (${size})\n` +
      `Score: ${score} (` +
      `Words: ${statistics.wordCount}, ` +
      `Swaps: ${statistics.swapCount}, ` +
      `Progress: ${statistics.progress}%)\n` +
      `${url.toString()}`

    await writeToClipboard(content)
    tippy.show()
    setTimeout(() => tippy.hide(), 1000)
  }

  update () {
    this.#updateWords()
    this.#updateStatistics()
    this.#updateSwaps()
  }

  #deleteSwap (event) {
    if (event.target.classList.contains(Game.ClassNames.Delete)) {
      this.#grid.removeSwap(event.target.dataset.index)
      this.update()
    }
  }

  #deleteWord (event) {
    if (event.target.classList.contains(Game.ClassNames.Delete)) {
      this.#grid.removeWord(event.target.dataset.index)
      this.update()
    }
  }

  #onExpand () {
    this.#state.set(State.Params.Expand, !this.#state.get(State.Params.Expand))
    this.#updateDrawer()
  }

  #onGridUpdate () {
    this.update()
  }

  #onIncludeStateChange (event) {
    const state = this.#state.get()
    state.includeStateInShareUrl = event.target.checked
    this.#state.set(state)
  }

  #onWidthChange (event) {
    State.params.set(State.Params.Width, event.target.value)
    State.reload()
  }

  #updateDrawer () {
    const state = this.#state.get()
    const expanded = state.expand === true
    $footer.classList.toggle(Game.ClassNames.Expanded, expanded)
    $expand.textContent = expanded ? 'expand_less' : 'expand_more'
    $includeState.checked = state.includeStateInShareUrl
  }

  #updateScore (words) {
    $score.textContent = this.getScore(words)
  }

  #updateSelection () {
    const selection = this.#grid.getSelection()

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
      const word = new Word(this.#grid.width, selection)
      const $points = document.createElement('span')
      $points.classList.add(Game.ClassNames.Points)
      $points.textContent = word.points
      children.push($points)
    }

    $selection.replaceChildren(...children)
  }

  #updateStatistics () {
    const statistics = this.#grid.getStatistics()
    $statistics.replaceChildren(...[
      { name: 'Average Word Length', value: statistics.averageWordLength },
      { name: 'Progress', value: `${statistics.progress}%` }
    ].map((item) => {
      const $content = document.createElement('span')
      $content.textContent = item.name
      const $value = document.createElement('span')
      $value.textContent = item.value
      return Game.getListItem($content, $value)
    }))
  }

  #updateSwaps () {
    const swaps = this.#grid.getSwaps()
    $swaps.replaceChildren(...swaps.map((swap, index) => {
      const $swap = document.createElement('span')
      $swap.classList.add(Game.ClassNames.Swap)
      $swap.textContent = `${swap.map((letter) => letter.toUpperCase()).join(' → ')}`
      return Game.getListItem($swap, Game.getDeleteElement(index))
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

  #updateWords () {
    const words = this.#grid.getWords()

    $words.replaceChildren(...words.map((word, index) => {
      const $word = document.createElement('span')
      $word.classList.add(Game.ClassNames.Word)
      $word.textContent = word.content
      const $points = document.createElement('span')
      $points.classList.add(Game.ClassNames.Points)
      $points.textContent = word.points
      return Game.getListItem([$word, $points], Game.getDeleteElement(index))
    }))

    this.#updateScore(words)
  }

  static getDeleteElement (index) {
    const $delete = document.createElement('span')
    $delete.classList.add(Game.ClassNames.Delete, Game.ClassNames.Icon)
    $delete.dataset.index = index.toString()
    $delete.textContent = 'delete'
    $delete.title = 'Delete'

    return $delete
  }

  static getListItem ($left, $right) {
    const $li = document.createElement('li')

    const $container = document.createElement('div')
    $container.classList.add(Game.ClassNames.Container)
    $li.append($container)

    const $containerLeft = document.createElement('div')
    $containerLeft.classList.add(Game.ClassNames.FlexLeft)
    $containerLeft.append(...(Array.isArray($left) ? $left : [$left]))
    $container.append($containerLeft)

    const $containerRight = document.createElement('div')
    $containerRight.classList.add(Game.ClassNames.FlexRight)
    $containerRight.append(...(Array.isArray($right) ? $right : [$right]))
    $container.append($containerRight)

    return $li
  }

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
}
