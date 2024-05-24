import { Grid } from './grid'
import { EventListeners } from './eventListeners'
import Tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { State } from './state'
import { getBaseUrl, reload, urlParams, writeToClipboard } from './util'
import { Cell } from './cell'
import { Cache } from './cache'
import { Dictionary } from './dictionary'
import { Word } from './word'

const $expand = document.getElementById('expand')
const $footer = document.getElementById('footer')
const $includeState = document.getElementById('include-state')
const $includeProfanity = document.getElementById('include-profanity')
const $new = document.getElementById('new')
const $path = document.getElementById('path')
const $reset = document.getElementById('reset')
const $selection = document.getElementById('selection')
const $share = document.getElementById('share')
const $statistics = document.getElementById('statistics')
const $status = document.getElementById('status')
const $swaps = document.getElementById('swaps')
const $undo = document.getElementById('undo')
const $width = document.getElementById('width')
const $words = document.getElementById('words')

const confirm = window.confirm
const crypto = window.crypto
const tippy = Tippy($share, { content: 'Copied!', theme: 'custom', trigger: 'manual' })

if (urlParams.has(Grid.Params.Solution.key)) {
  document.body.classList.add('share')
}

export class Game {
  #dictionary
  #eventListeners = new EventListeners({ context: this })
  #grid
  #state

  constructor () {
    const overrides = [Game.Params.Expand]
    this.#state = new State('game', {}, { overrides })

    this.#dictionary = new Dictionary()
    this.#grid = new Grid(this.#dictionary)

    const configuration = this.#grid.getConfiguration()
    $new.href = `?${Grid.Params.Id.key}=${crypto.randomUUID().split('-')[0]}`
    $path.href = `?${Grid.Params.Id.key}=${configuration.id}`
    $path.textContent = configuration.id

    this.#eventListeners.add([
      { type: 'change', element: $includeProfanity, handler: this.#onIncludeProfanityChange },
      { type: 'change', element: $includeState, handler: this.#onIncludeStateChange },
      { type: 'change', element: $width, handler: this.#onWidthChange },
      { type: 'click', element: $expand, handler: this.#onExpand },
      { type: 'click', element: $reset, handler: this.reset },
      { type: 'click', element: $share, handler: this.share },
      { type: 'click', element: $swaps, handler: this.#deleteSwap },
      { type: 'click', element: $undo, handler: this.#onUndo },
      { type: 'click', element: $words, handler: this.#deleteWord },
      { type: Grid.Events.Selection, handler: this.#updateSelection },
      { type: Grid.Events.Update, handler: this.#onGridUpdate }
    ])

    this.#updateDrawer()
    this.#updateWidthSelector()
  }

  reset () {
    // Resolving in promise to prevent the Chrome 'Violation' warning in console
    return Promise.resolve().then(() => {
      if (!confirm('Are you sure you want to reset the grid?')) {
        return
      }
      this.#grid.reset()
      this.update()
    })
  }

  async setup () {
    // Load the base dictionary, and generate the grid from that
    await this.#dictionary.load(Dictionary.Sources.Default)
    this.#grid.setup()
    this.update()

    // TODO make dictionary loading more generic
    const state = this.#state.get()
    if (
      // User has the dictionary enabled
      state.includeProfanityInDictionary ||
      // User has validated profane words, or loaded a share URL with profane words in it
      this.#grid.getSources().includes(Dictionary.Names.Profanity)
    ) {
      // Profane words can be validated, but they won't be used to generate the grid
      await this.#dictionary.load(Dictionary.Sources.Profanity)
    }
  }

  async share () {
    const { id, mode, width } = this.#grid.getConfiguration()
    const size = `${width}x${width}`
    const state = this.#state.get()
    const url = getBaseUrl()
    const statistics = this.#grid.getStatistics()

    url.searchParams.set(Grid.Params.Id.key, id)

    if (mode !== Grid.Modes.Default) {
      url.searchParams.set(Grid.Params.Mode.key, mode)
    }

    if (width !== Grid.DefaultWidth) {
      url.searchParams.set(Grid.Params.Width.key, width)
    }

    if (state.includeStateInShareUrl) {
      url.searchParams.set(Grid.Params.Solution.key, Grid.Params.Solution.encode(this.#grid.getState().solution))
    }

    const sources = this.#grid.getSources()
    const moves = statistics.moves.map((move) => Game.Moves[move]).join('')

    // TODO update this for casual vs challenge mode.
    //  Casual mode should only show % filled and words correct
    //  Challenge mode should display score and rating along with % filled
    const content = `Path: #${id} (${size})\n` +
      `Score: ${statistics.score} ` +
      `${statistics.rating.description} ${statistics.rating.emoji} (${statistics.progress}% filled)\n` +
      (moves ? `Moves: ${moves}\n` : '') +
      (sources.length > 1 ? `Dictionary: ${sources.join(' + ')}\n` : '') +
      `${url.toString()}`

    await writeToClipboard(content)
    tippy.show()
    setTimeout(() => tippy.hide(), 1000)
  }

  update () {
    this.#updateStatistics()
    this.#updateSwaps()
    this.#updateUndo()
    this.#updateWords()
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
    this.#state.set(Game.Params.Expand.key, !this.#state.get(Game.Params.Expand.key))
    this.#updateDrawer()
  }

  #onGridUpdate () {
    this.update()
  }

  async #onIncludeProfanityChange (event) {
    const state = this.#state.get()
    state.includeProfanityInDictionary = event.target.checked
    if (state.includeProfanityInDictionary) {
      await this.#dictionary.load(Dictionary.Sources.Profanity)
    } else {
      this.#dictionary.unload(Dictionary.Sources.Profanity)
    }
    this.#state.set(state)
  }

  #onIncludeStateChange (event) {
    const state = this.#state.get()
    state.includeStateInShareUrl = event.target.checked
    this.#state.set(state)
  }

  #onUndo () {
    if (!$undo.classList.contains(Game.ClassNames.Disabled)) {
      this.#grid.undo()
    }
  }

  #onWidthChange (event) {
    Grid.Params.Width.set(event.target.value)
    reload()
  }

  #updateDrawer () {
    const state = this.#state.get()
    const expanded = state.expand === true
    $footer.classList.toggle(Game.ClassNames.Expanded, expanded)
    $expand.textContent = expanded ? 'expand_less' : 'expand_more'
    $includeProfanity.checked = state.includeProfanityInDictionary
    $includeState.checked = state.includeStateInShareUrl
  }

  #updateSelection () {
    this.#updateUndo()

    const selection = this.#grid.getSelection().filter((cell) => !cell.getFlags().has(Cell.Flags.Swap))
    $selection.replaceChildren()
    $selection.classList.remove(Game.ClassNames.Valid)

    if (!selection.length) {
      return
    }

    const $content = document.createElement('span')
    $content.textContent = Grid.getContent(selection)

    const children = [$content]
    if (this.#dictionary.isValid($content.textContent)) {
      $content.classList.add(Game.ClassNames.Valid)
    } else {
      const content = Grid.getContent(selection.reverse())
      if (this.#dictionary.isValid(content)) {
        $content.classList.add(Game.ClassNames.Valid)
        $content.textContent = content
      }
    }

    if ($content.classList.contains(Game.ClassNames.Valid)) {
      const configuration = this.#grid.getConfiguration()
      const word = new Word(configuration.width, selection)
      const $points = document.createElement('span')
      $points.classList.add(Game.ClassNames.Points)
      $points.textContent = word.points
      children.push($points)
    }

    $selection.replaceChildren(...children)
  }

  #updateStatistics () {
    const statistics = this.#grid.getStatistics()
    $status.textContent = statistics.score
    $statistics.replaceChildren(...[
      { name: 'Average Word Length', value: statistics.averageWordLength },
      { name: 'Progress', value: `${statistics.progress}%` },
      { name: 'Rating', value: `${statistics.rating.description} ${statistics.rating.emoji}` },
      { name: 'Your Best Score', value: `${statistics.best} (${statistics.bestDiff})` }
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

  #updateUndo () {
    const moves = this.#grid.getMoves()
    const selection = this.#grid.getSelection()
    const disabled = moves.length === 0 && selection.length === 0
    $undo.classList.toggle(Game.ClassNames.Disabled, disabled)
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
      $word.textContent = `${index + 1}. ${word.content}`
      const $points = document.createElement('span')
      $points.classList.add(Game.ClassNames.Points)
      $points.textContent = word.points
      return Game.getListItem([$word, $points], Game.getDeleteElement(index))
    }))
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
    Disabled: 'disabled',
    Expanded: 'expanded',
    FlexLeft: 'flex-left',
    FlexRight: 'flex-right',
    Icon: 'material-symbols-outlined',
    Points: 'points',
    Swap: 'swap',
    Valid: 'valid',
    Word: 'word'
  })

  static Moves = Object.freeze({
    [Grid.Moves.Hint]: '💡',
    [Grid.Moves.Spell]: '🟢',
    [Grid.Moves.Swap]: '🟣'
  })

  static Params = Object.freeze({
    Expand: Cache.urlParams('expand')
  })
}
