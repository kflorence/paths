import { Grid } from './grid'
import { EventListeners } from './eventListeners'
import Tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { State } from './state'
import { getBaseUrl, optionally, reload, urlParams, writeToClipboard } from './util'
import { Cell } from './cell'
import { Cache } from './cache'
import { Dictionary } from './dictionary'
import { Word } from './word'

const $expand = document.getElementById('expand')
const $footer = document.getElementById('footer')
const $hint = document.getElementById('hint')
const $includeState = document.getElementById('include-state')
const $includeProfanity = document.getElementById('include-profanity')
const $mode = document.getElementById('mode')
const $new = document.getElementById('new')
const $path = document.getElementById('path')
const $reset = document.getElementById('reset')
const $selection = document.getElementById('selection')
const $share = document.getElementById('share')
const $statistics = document.querySelector('#statistics > ul')
const $status = document.getElementById('status')
const $swaps = document.querySelector('#swaps > ul')
const $undo = document.getElementById('undo')
const $width = document.getElementById('width')
const $words = document.querySelector('#words > ul')

const confirm = window.confirm
const crypto = window.crypto
const tippy = Tippy($share, { content: 'Copied!', theme: 'custom', trigger: 'manual' })

if (urlParams.has(Grid.Params.Solution.key)) {
  document.body.classList.add('share')
}

export class Game {
  #configuration
  #dictionary
  #eventListeners = new EventListeners({ context: this })
  #grid
  #state

  constructor () {
    const overrides = [Game.Params.Expand]
    this.#state = new State('game', {}, { overrides })

    this.#dictionary = new Dictionary()

    const mode = this.#getMode()
    const width = this.#getWidth()

    this.#grid = new Grid(this.#dictionary, width, mode)
    this.#configuration = this.#grid.getConfiguration()

    $new.href = `?${Grid.Params.Id.key}=${crypto.randomUUID().split('-')[0]}`
    $path.href = `?${Grid.Params.Id.key}=${this.#configuration.id}`
    $path.textContent = this.#configuration.id

    this.#eventListeners.add([
      { type: 'change', element: $includeProfanity, handler: this.#onIncludeProfanityChange },
      { type: 'change', element: $includeState, handler: this.#onIncludeStateChange },
      { type: 'change', element: $mode, handler: this.#onModeChange },
      { type: 'change', element: $width, handler: this.#onWidthChange },
      { type: 'click', element: $expand, handler: this.#onExpand },
      { type: 'click', element: $hint, handler: this.#onHint },
      { type: 'click', element: $reset, handler: this.reset },
      { type: 'click', element: $share, handler: this.share },
      { type: 'click', element: $swaps, handler: this.#deleteSwap },
      { type: 'click', element: $undo, handler: this.#onUndo },
      { type: 'click', element: $words, handler: this.#deleteWord },
      { type: Grid.Events.Selection, handler: this.#updateSelection },
      { type: Grid.Events.Update, handler: this.#onGridUpdate }
    ])

    this.#updateDrawer()
    this.#updateModeSelector()
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
    const { id, mode, width } = this.#configuration
    const size = `${width}x${width}`
    const state = this.#state.get()
    const url = getBaseUrl()
    const statistics = this.#grid.getStatistics()

    url.searchParams.set(Grid.Params.Id.key, id)

    if (mode !== Grid.DefaultMode) {
      url.searchParams.set(Grid.Params.Mode.key, mode)
    }

    if (width !== Grid.DefaultWidth) {
      url.searchParams.set(Grid.Params.Width.key, width)
    }

    if (state.includeStateInShareUrl) {
      url.searchParams.set(Grid.Params.Solution.key, Grid.Params.Solution.encode(this.#grid.getState().solution))
    }

    const content = [`Path#${id} | ${size} | ${statistics.secretWordsGuessed}/${statistics.secretWordCount}`]

    if (mode === Grid.Modes.Challenge) {
      content.push(`Score: ${statistics.score} / ${statistics.progress}%`)
    }

    let moves = ''
    const lastMovesIndex = statistics.moves.length - 1
    statistics.moves.forEach((move, index) => {
      moves += move.symbol
      if (index !== lastMovesIndex && (index + 1) % width === 0) {
        moves += '\n'
      }
    })

    content.push(moves)

    const sources = this.#grid.getSources()
    if (sources.length > 1) {
      content.push(`Dictionary: ${sources.join(' + ')}`)
    }

    content.push(url.toString())

    console.debug(content)

    await writeToClipboard(content.join('\n'))
    tippy.show()
    setTimeout(() => tippy.hide(), 1000)
  }

  update () {
    this.#updateHint()
    this.#updateStatus()
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

  #getMode () {
    return Grid.Params.Mode.get() ?? this.#state.get(Grid.Params.Mode.key) ?? Grid.DefaultMode
  }

  #getWidth () {
    return Grid.Params.Width.get() ?? optionally(this.#state.get(Grid.Params.Width.key), Number) ?? Grid.DefaultWidth
  }

  #onExpand () {
    this.#state.set(Game.Params.Expand.key, !this.#state.get(Game.Params.Expand.key))
    this.#updateDrawer()
  }

  #onGridUpdate () {
    this.update()
  }

  #onHint () {
    this.#grid.hint()
    this.#updateHint()
  }

  async #onIncludeProfanityChange (event) {
    const state = this.#state.get()
    state.includeProfanityInDictionary = event.target.checked
    if (state.includeProfanityInDictionary) {
      await this.#dictionary.load(Dictionary.Sources.Profanity)
    } else {
      this.#dictionary.unload(Dictionary.Names.Profanity)
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

  #onModeChange (event) {
    const mode = event.target.value
    const state = this.#state.get()
    state.mode = mode
    this.#state.set(state)

    Grid.Params.Mode.set(mode)

    reload()
  }

  #onWidthChange (event) {
    const width = Number(event.target.value)
    const state = this.#state.get()
    state.width = width
    this.#state.set(state)

    Grid.Params.Width.set(width)

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

  #updateHint () {
    $hint.classList.toggle(Game.ClassNames.Disabled, !this.#grid.hasHint())
  }

  #updateSelection () {
    this.#updateUndo()

    const selection = this.#grid.getSelection()
    $selection.replaceChildren()
    $selection.classList.remove(Game.ClassNames.Valid)

    // Ignore cells marked for swap
    if (!selection.cells.filter((cell) => !cell.getFlags().has(Cell.Flags.Swap)).length) {
      // Nothing to do
      return
    }

    const $content = document.createElement('span')
    $content.textContent = selection.content
    $content.classList.toggle(Game.ClassNames.Valid, selection.isValidWord)

    const children = [$content]
    if (selection.isValidWord && this.#configuration.mode === Grid.Modes.Challenge) {
      const configuration = this.#grid.getConfiguration()
      const word = new Word(configuration.width, selection.cells, selection.match)
      const $points = document.createElement('span')
      $points.classList.add(Game.ClassNames.Points)
      $points.textContent = word.points
      children.push($points)
    }

    $selection.replaceChildren(...children)
  }

  #updateStatus () {
    const statistics = this.#grid.getStatistics()
    const secretWords = `${statistics.secretWordsGuessed}/${statistics.secretWordCount}`
    if (this.#configuration.mode === Grid.Modes.Challenge) {
      $status.textContent = statistics.score
      $statistics.replaceChildren(...[
        { name: 'Progress', value: `${statistics.progress}%` },
        { name: 'Average Word Length', value: statistics.averageWordLength },
        { name: 'Secret Words Found', value: secretWords },
        { name: 'Your Best Score', value: `${statistics.best} (${statistics.bestDiff})` }
      ].map((item) => {
        const $content = document.createElement('span')
        $content.textContent = item.name
        const $value = document.createElement('span')
        $value.textContent = item.value
        return Game.getListItem($content, $value)
      }))
    } else {
      $status.textContent = secretWords
    }
  }

  #updateSwaps () {
    const swaps = this.#grid.getSwaps()
    // noinspection JSCheckFunctionSignatures
    $swaps.replaceChildren(...swaps.map((swap, index) => {
      const $swap = document.createElement('span')
      $swap.classList.add(Game.ClassNames.Swap)
      $swap.textContent = `${swap.map((letter) => letter.toUpperCase()).join(' → ')}`
      return Game.getListItem($swap, Game.getDeleteElement(index))
    }))
  }

  #updateUndo () {
    const moves = this.#grid.getMoves().filter((move) => move.type !== Grid.Move.Types.Hint)
    const selection = this.#grid.getSelection()
    const disabled = moves.length === 0 && selection.length === 0
    $undo.classList.toggle(Game.ClassNames.Disabled, disabled)
  }

  #updateModeSelector () {
    const mode = this.#getMode()
    $mode.replaceChildren(...Object.entries(Grid.Modes).map(([key, value]) => {
      const $option = document.createElement('option')
      $option.textContent = key
      $option.value = value
      if (value === mode) {
        $option.selected = true
      }
      return $option
    }))
  }

  #updateWidthSelector () {
    const width = this.#getWidth()
    $width.replaceChildren(...Grid.Widths.map((value) => {
      const $option = document.createElement('option')
      $option.textContent = `${value}x${value}`
      $option.value = value.toString()
      if (value === width) {
        $option.selected = true
      }
      return $option
    }))
  }

  #updateWords () {
    const words = this.#grid.getWords()
    $words.replaceChildren(...words.map((word, index) => {
      const $index = document.createElement('span')
      $index.textContent = `${index + 1}.`
      const $word = document.createElement('span')
      $word.classList.add(Game.ClassNames.Word)
      $word.classList.toggle(Game.ClassNames.MatchExact, word.match === Grid.Match.Exact)
      $word.classList.toggle(Game.ClassNames.MatchPartial, word.match === Grid.Match.Partial)
      $word.textContent = word.content
      const $points = document.createElement('span')
      $points.classList.add(Game.ClassNames.Points)
      $points.textContent = word.points
      return this.#configuration.mode === Grid.DefaultMode
        ? Game.getListItem([$index, $word])
        : Game.getListItem([$index, $word, $points], Game.getDeleteElement(index))
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

    if ($right !== undefined) {
      const $containerRight = document.createElement('div')
      $containerRight.classList.add(Game.ClassNames.FlexRight)
      $containerRight.append(...(Array.isArray($right) ? $right : [$right]))
      $container.append($containerRight)
    }

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
    MatchExact: 'match-exact',
    MatchPartial: 'match-partial',
    Points: 'points',
    Swap: 'swap',
    Valid: 'valid',
    Word: 'word'
  })

  static Params = Object.freeze({
    Expand: Cache.urlParams('expand')
  })
}
