import { Grid } from './grid'
import { EventListeners } from './eventListeners'
import Tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { State } from './state'
import { getBaseUrl, getClassName, getSign, optionally, reload, url, urlParams, writeToClipboard } from './util'
import { Cell } from './cell'
import { Cache } from './cache'
import { Dictionary } from './dictionary'
import { Word } from './word'

const $expand = document.getElementById('expand')
const $footer = document.getElementById('footer')
const $hint = document.getElementById('hint')
const $includeProfanity = document.getElementById('include-profanity')
const $includeSolution = document.getElementById('include-solution')
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

export class Game {
  #configuration
  #dictionary
  #eventListeners = new EventListeners({ context: this })
  #grid
  #state

  constructor () {
    const overrides = [Game.Params.DrawerExpanded]
    const initialState = Game.State.fromObject({ version: Game.State.Version })
    this.#state = new State(Game.CacheKey, initialState, { overrides })

    const state = this.#getState()
    if (state.version < Game.State.Version) {
      console.warn(`Ignoring stale cache with version ${state.version}. Current version: ${Game.State.Version}`)
      this.#state.set(initialState)
    }

    this.#dictionary = new Dictionary()

    const mode = this.#getMode()
    const width = this.#getWidth()

    this.#grid = new Grid(this.#dictionary, width, mode)
    this.#configuration = this.#grid.getConfiguration()

    const params = new URLSearchParams(url.search)
    params.set(Grid.Params.Id.key, crypto.randomUUID().split('-')[0])

    $new.href = `?${params.toString()}`
    $path.href = `?${Grid.Params.Id.key}=${this.#configuration.id}`
    $path.textContent = this.#configuration.id

    this.#eventListeners.add([
      { type: 'change', element: $includeProfanity, handler: this.#onIncludeProfanityChange },
      { type: 'change', element: $includeSolution, handler: this.#onIncludeSolutionChange },
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

    const state = this.#getState()

    // Note that additional dictionary sources are not used to generate the grid. They are only used for validation.
    const additionalSources = Array.from(new Set(
      this.#grid.getState().getSources()
        .filter((source) => source !== Dictionary.Names.Default)
        .concat(state.additionalSources)
    ))

    for await (const source of additionalSources) {
      await this.#dictionary.load(Dictionary.SourcesByName[source])
    }
  }

  async share () {
    const { id, mode, width } = this.#configuration
    const size = `${width}x${width}`
    const gameState = this.#getState()
    const gridState = this.#grid.getState()
    const statistics = this.#grid.getStatistics(gridState)

    const content = [`Path#${id} | ${size} | ${statistics.hiddenWordsGuessed}/${statistics.hiddenWordCount}`]

    if (mode === Grid.Modes.Challenge) {
      content.push(`Score: ${statistics.score} / ${statistics.progress}%`)
    }

    let moves = ''
    const lastMovesIndex = statistics.moves.length - 1
    statistics.moves.forEach((move, index) => {
      moves += move.getSymbol(mode)
      if (index !== lastMovesIndex && (index + 1) % width === 0) {
        moves += '\n'
      }
    })

    if (moves) {
      content.push(moves)
    }

    const sources = gridState.getSources()
    if (sources.length > 1) {
      content.push(`Dictionary: ${sources.join(' + ')}`)
    }

    content.push(gameState.shareUrl.get(gridState, this.#configuration))

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
    return Grid.Params.Mode.get() ?? Grid.DefaultMode
  }

  #getState () {
    return Game.State.fromObject(this.#state.get())
  }

  #getWidth () {
    return optionally(Grid.Params.Width.get(), Number) ?? Grid.DefaultWidth
  }

  #onExpand () {
    this.#state.set(Game.Params.DrawerExpanded.key, !this.#state.get(Game.Params.DrawerExpanded.key))
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
    const state = this.#getState()
    if (event.target.checked) {
      state.additionalSources = Array.from(new Set(state.additionalSources.concat([Dictionary.Names.Profanity])))
      await this.#dictionary.load(Dictionary.Sources.Profanity)
    } else {
      const index = state.additionalSources.findIndex((source) => source === Dictionary.Names.Profanity)
      state.additionalSources.splice(index, 1)
      this.#dictionary.unload(Dictionary.Names.Profanity)
    }
    this.#state.set(state)
  }

  #onIncludeSolutionChange (event) {
    const state = this.#getState()
    state.shareUrl = state.shareUrl.copy({ solution: event.target.checked })
    this.#state.set(state)
  }

  #onUndo () {
    if (!$undo.classList.contains(Game.ClassNames.Disabled)) {
      this.#grid.undo()
    }
  }

  #onModeChange (event) {
    Grid.Params.Mode.set(event.target.value)
    reload()
  }

  #onWidthChange (event) {
    Grid.Params.Width.set(event.target.value)
    reload()
  }

  #updateDrawer () {
    const state = this.#getState()
    $footer.classList.toggle(Game.ClassNames.Expanded, state.drawerExpanded)
    $expand.textContent = state.drawerExpanded ? 'expand_less' : 'expand_more'
    $includeProfanity.checked = state.additionalSources.includes(Dictionary.Names.Profanity)
    $includeSolution.checked = state.shareUrl.solution
  }

  #updateHint () {
    $hint.classList.toggle(Game.ClassNames.Disabled, !this.#grid.hasHint())
  }

  #updateSelection () {
    this.#updateUndo()

    const selection = this.#grid.getSelection()
    $selection.replaceChildren()
    $selection.classList.remove(Game.ClassNames.WordValid)

    // Ignore cells marked for swap
    if (!selection.cells.filter((cell) => !cell.getFlags().has(Cell.Flags.Swap)).length) {
      // Nothing to do
      return
    }

    const $content = document.createElement('span')
    $content.textContent = selection.content
    $content.classList.toggle(Game.ClassNames.WordValid, selection.isValidWord)

    const children = [$content]
    if (selection.isValidWord) {
      const $info = document.createElement('span')
      $info.classList.add(Game.ClassNames.WordInfo)

      if (this.#configuration.mode === Grid.Modes.Pathfinder) {
        $info.textContent = getSign(selection.hiddenWordIndexes.length - selection.content.length)
      } else {
        const configuration = this.#grid.getConfiguration()
        const move = new Grid.Move(Grid.Move.Types.Spell, { match: selection.match })
        const word = new Word(configuration.width, selection.cells, move)
        $info.textContent = word.points
      }

      children.push($info)
    }

    $selection.replaceChildren(...children)
  }

  #updateStatus () {
    const statistics = this.#grid.getStatistics()
    const hiddenWords = `${statistics.hiddenWordsGuessed}/${statistics.hiddenWordCount}`
    if (this.#configuration.mode === Grid.Modes.Challenge) {
      $status.textContent = statistics.score
      $statistics.replaceChildren(...[
        { name: 'Progress', value: `${statistics.progress}%` },
        { name: 'Average Word Length', value: statistics.averageWordLength },
        { name: 'Hidden Words Found', value: hiddenWords },
        { name: 'Your Best Score', value: `${statistics.best} (${statistics.bestDiff})` },
        { name: 'Best Possible Score', value: statistics.bestPossible }
      ].map((item) => {
        const $content = document.createElement('span')
        $content.textContent = item.name
        const $value = document.createElement('span')
        $value.textContent = item.value
        return Game.getListItem($content, $value)
      }))
    } else {
      $status.textContent = hiddenWords
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
    const state = this.#grid.getState()
    const words = this.#grid.getWords(state).reverse()
    const length = words.length
    const isPathfinderMode = this.#configuration.mode === Grid.Modes.Pathfinder
    $words.replaceChildren(...words.map((word, index) => {
      const data = word.move.value
      const $index = document.createElement('span')
      $index.textContent = `${length - index}.`
      const $word = document.createElement('a')
      $word.classList.add(Game.ClassNames.Word, getClassName(Game.ClassNames.Word, 'match', data.match))
      $word.href = 'https://en.wiktionary.org/wiki/' + word.content
      $word.target = '_blank'
      $word.textContent = word.content
      $word.title = 'See definition'
      const $info = document.createElement('span')
      $info.classList.add(Game.ClassNames.WordInfo)
      $info.textContent = isPathfinderMode
        ? getSign(state.configuration.words[data.hiddenWordIndex].length - word.content.length)
        : word.points
      const $delete = isPathfinderMode ? undefined : Game.getDeleteElement(index)
      return Game.getListItem([$index, $word, $info], $delete)
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

  static CacheKey = 'game'

  static ClassNames = Object.freeze({
    Container: 'container',
    Delete: 'delete',
    Disabled: 'disabled',
    Expanded: 'expanded',
    FlexLeft: 'flex-left',
    FlexRight: 'flex-right',
    Icon: 'material-symbols-outlined',
    Share: 'share',
    Swap: 'swap',
    Word: 'word',
    WordInfo: 'word-info',
    WordValid: 'word-valid'
  })

  static Params = Object.freeze({
    DrawerExpanded: Cache.urlParams('drawerExpanded')
  })

  static State = class {
    additionalSources
    drawerExpanded
    shareUrl
    version

    constructor (drawerExpanded, shareUrl, additionalSources, version) {
      this.drawerExpanded = drawerExpanded ?? false
      this.shareUrl = shareUrl ?? new Game.State.ShareUrl()
      this.additionalSources = additionalSources ?? []
      this.version = version ?? 0
    }

    static fromObject (obj) {
      return new Game.State(
        obj.drawerExpanded,
        optionally(obj.shareUrl, Game.State.ShareUrl.fromObject),
        obj.additionalSources,
        obj.version
      )
    }

    static ShareUrl = class {
      solution

      constructor (solution) {
        this.solution = solution ?? false
      }

      copy (settings) {
        return new Game.State.ShareUrl(settings.solution ?? this.solution)
      }

      get (state, configuration) {
        const url = getBaseUrl()

        url.searchParams.set(Grid.Params.Id.key, configuration.id)
        url.searchParams.set(Grid.Params.Mode.key, configuration.mode)
        url.searchParams.set(Grid.Params.Width.key, configuration.width)

        if (this.solution) {
          url.searchParams.set(Grid.Params.Solution.key, Grid.Params.Solution.encode(state.solution))
        }

        return url.toString()
      }

      static fromObject (obj) {
        return new Game.State.ShareUrl(obj.solution)
      }
    }

    static Version = 1
  }
}

if (urlParams.has(Grid.Params.Solution.key)) {
  document.body.classList.add(Game.ClassNames.Share)
}
