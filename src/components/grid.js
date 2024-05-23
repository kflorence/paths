import { Cell } from './cell'
import { Coordinates } from './coordinates'
import { State } from './state'
import { EventListeners } from './eventListeners'
import { Word } from './word'
import { Flags } from './flag'
import { cyrb53, getClassName, history, splitmix32, url, urlParams } from './util'
import { Cache } from './cache'
import { Dictionary } from './dictionary'
import { SelfAvoidingWalk } from './generators/selfAvoidingWalk'
import { Scramble } from './generators/scramble'

const $grid = document.getElementById('grid')

export class Grid {
  configuration
  dictionary

  #active
  #cells = []
  #eventListeners = new EventListeners({ context: this, element: $grid })
  #pointerIndex = -1
  #selection = []
  #selectionStart
  #state

  constructor (dictionary) {
    this.configuration = new Grid.Configuration()
    this.dictionary = dictionary

    const solution = Grid.getSolution(this.configuration.hash)
    // Don't persist changes locally if a solution is provided in the URL
    const persistence = solution === undefined
    this.#state = new State(this.configuration.hash, { solution }, { persistence })

    $grid.dataset.width = this.configuration.width

    this.#eventListeners.add([
      { type: Cell.Events.Select, handler: this.#onSelect },
      { type: 'pointerup', element: document, handler: this.#onPointerUp }
    ])
  }

  getMoves () {
    return this.#getState().moves
  }

  getSeedWords () {
    return Array.from(this.configuration.words)
  }

  getSelection () {
    return Array.from(this.#selection)
  }

  getSources () {
    return Array.from(new Set([Dictionary.Names.Default].concat(this.#getState().dictionary))).sort()
  }

  getState () {
    return this.#state.get()
  }

  getStatistics (state) {
    state ??= this.#getState()
    return new Grid.Statistics(state, this.getWords(state), this.configuration.size)
  }

  getSwaps () {
    return this.#getState().swaps.map((indexes) => indexes.map((index) => {
      const cell = this.#cells[index]
      const content = this.#configuration[index].content
      const coordinates = cell.getCoordinates().toString()
      return `${content} (${coordinates})`
    }))
  }

  getWords (state) {
    return (state ?? this.#getState())
      .words.map((indexes) => new Word(this.width, indexes.map((index) => this.#cells[index])))
  }

  removeSwap (index) {
    const state = this.#getState()

    // Remove the swap
    const swap = state.swaps.splice(index, 1)[0]

    // Update moves
    const move = [Grid.Moves.Swap, index].join(':')
    const moveIndex = state.moves.findIndex((m) => move === m)
    state.moves.splice(moveIndex, 1)

    this.#setState(state)

    // If one of the swapped cells was part of a word, remove the word, too.
    const wordIndex = state.words.findIndex((indexes) => swap.some((index) => indexes.indexOf(index) >= 0))
    if (wordIndex >= 0) {
      this.removeWord(wordIndex)
    }

    this.#update(swap)
  }

  removeWord (index) {
    const state = this.#getState()

    // Remove the word and everything after it
    const firstRemovedWord = state.words.splice(index)[0]
    const earliestPathIndex = state.path.findIndex((index) => firstRemovedWord.indexOf(index) >= 0)

    // Remove everything after and including the first matched path index.
    const pathIndexes = state.path.splice(earliestPathIndex)

    // Update dictionary
    state.dictionary.splice(index)

    // Update moves
    state.moves = state.moves.filter((move) => {
      const [type, wordIndex] = move.split(':')
      // Remove any spell moves including and after the removed word index
      return !(type === Grid.Moves.Spell && wordIndex >= index)
    })

    this.#setState(state)

    const lastPathItemIndex = state.path[state.path.length - 1]
    if (lastPathItemIndex !== undefined) {
      // Also update the last path item so the link can be removed.
      pathIndexes.push(lastPathItemIndex)
    }

    this.#update(pathIndexes)
  }

  reset () {
    this.#state.update((state) => {
      delete state[Grid.State.Keys.Solution]
      return state
    })
    this.#update(Grid.getIndexes(this.#cells))
  }

  setup () {
    let configuration = this.#state.get(Grid.State.Keys.Configuration)
    if (!configuration) {
      // This grid has not been generated yet. Generate it and cache it.
      const generator = this.configuration.mode === Grid.Modes.Casual
        ? new SelfAvoidingWalk(this.configuration, this.dictionary)
        : new Scramble(this.configuration, this.dictionary)
      configuration = generator.generate()
      this.#state.set(Grid.State.Keys.Configuration, configuration)
    }

    this.#cells = configuration.cells
    this.#update(Grid.getIndexes(this.#cells))

    $grid.replaceChildren(...this.#cells.map((cell) => cell.getElement()))
    $grid.classList.remove(Grid.ClassNames.Loading)
  }

  undo () {
    if (this.#selection.length) {
      // If there is an active selection, de-select it.
      this.#deselect(this.#selection.splice(0))
      return
    }

    const state = this.#getState()
    if (state.moves.length === 0) {
      // If there are no moves, nothing to do.
      return
    }

    const [type, index] = state.moves[state.moves.length - 1].split(':')
    switch (type) {
      case Grid.Moves.Spell:
        this.removeWord(index)
        break
      case Grid.Moves.Swap:
        this.removeSwap(index)
        break
    }
  }

  #activate (cell) {
    this.#deactivate()
    cell.update((state) => state.copy({ flags: state.getFlags().add(Cell.Flags.Active) }))
    this.#active = cell
  }

  #anchorSelection (lastPathItem) {
    const anchor = this.#selection[this.#getSelectionAnchorIndex(lastPathItem)]
    if (anchor) {
      // Visually anchor the selection to the end of the path.
      const direction = lastPathItem.getDirection(anchor)
      lastPathItem.update((state) => state.copy({ flags: state.getFlags().add(Cell.FlagsByName[direction]) }))
    }
  }

  #deactivate () {
    if (!this.#active) {
      return
    }

    this.#active.update((state) => state.copy({ flags: state.getFlags().remove(Cell.Flags.Active) }))
    this.#active = undefined
  }

  #deselect (selection) {
    selection.forEach((cell) => cell.reset())
    const lastPathItem = this.#getLastPathItem()
    if (lastPathItem) {
      this.#update([lastPathItem.getIndex()])
    }
    this.#dispatch(Grid.Events.Selection)
  }

  #dispatch (name, detail = null) {
    const event = new CustomEvent(name, { detail })
    // Ensure event is emitted after any currently processing events have been handled
    setTimeout(() => document.dispatchEvent(event))
  }

  #getLastPathItem () {
    const state = this.#getState()
    return this.#cells[state.path[state.path.length - 1]]
  }

  #getSelectionAnchorIndex (lastPathItem) {
    if (this.#selection.length === 0) {
      return
    }

    lastPathItem ??= this.#getLastPathItem()
    if (!lastPathItem) {
      return
    }

    // Try to anchor at the head of the selection first.
    const indexes = [0]
    const lastIndex = this.#selection.length - 1
    if (lastIndex !== 0) {
      indexes.push(lastIndex)
    }

    return indexes.find((index) => {
      const cell = this.#selection[index]
      return !cell.getFlags().has(Cell.Flags.Swap) && this.#isValid(lastPathItem, cell)
    }) ?? -1
  }

  #getState () {
    return Grid.State.fromShareUrl(this.#state.get())
  }

  #isCrossing (source, target) {
    // Get the neighbors that if connected would cause the path to cross
    const [first, second] = source
      .getCoordinates()
      .getNeighborsCrossing(target.getCoordinates())
      .map((neighbor) => this.#cells[neighbor.index]) // FIXME
    // Check both of them to see if they are connected to the other one in any direction.
    return first?.isConnected(second) || second?.isConnected(first) || false
  }

  #isValid (source, target) {
    return source?.isNeighbor(target) && !this.#isCrossing(source, target)
  }

  #onPointerUp (event) {
    this.#deactivate()

    if (!this.#selectionStart) {
      // User did not tap on a cell.
      if (!event.target.closest('#grid') && !event.target.closest('#undo')) {
        // User tapped outside the grid area and not on the undo button, de-select everything.
        this.#deselect(this.#selection.splice(0))
      }
      return
    }

    const length = this.#selection.length
    const count = length - this.#selectionStart.length
    if (count > 1) {
      // User selected multiple cells before pointerup was fired. Validate the selection.
      this.#validate()
    } else if (length === 2) {
      const last = this.#selection[length - 1]
      if (last.getFlags().has(Cell.Flags.Swap)) {
        this.#swap(...this.#selection.splice(0))
      }
    }

    this.#selectionStart = undefined
  }

  #onSelect (event) {
    if (!this.#selectionStart && event.detail.event.type !== 'pointerdown') {
      console.debug('Ignoring cell events prior to pointerdown.')
      // Mobile sends out a 'pointerenter' event before the first 'pointerdown'.
      // Ignore it, otherwise onSelect will get called multiple times for a single touch.
      return
    }

    const cell = event.detail.cell

    this.#activate(cell)

    if (cell.getFlags().has(Cell.Flags.Validated)) {
      // These cells cannot be selected
      return
    }

    // User is doing a multi-select if multiple onSelect events have been fired before pointerup resets selectionStart.
    const isMultiSelect = this.#selectionStart !== undefined
    if (!isMultiSelect) {
      // Save a reference to the first selection event.
      this.#selectionStart = new Grid.SelectionStart(event, this.#selection.length)
    } else if (this.#selection.length === 0) {
      console.debug('SelectMultiple: Selection was cleared during multi-select. Wait for pointerup before continuing.')
      return
    }

    const flags = []
    const lastCell = this.#selection[this.#selection.length - 1]
    const selectedIndex = this.#selection.findIndex((selected) => selected.equals(cell))

    if (lastCell?.getFlags().has(Cell.Flags.Swap)) {
      this.#onSwap(cell, lastCell, flags, selectedIndex, isMultiSelect)
    } else {
      const isNeighbor = cell.isNeighbor(lastCell)
      const isValid = this.#isValid(lastCell, cell)
      if (isMultiSelect) {
        this.#onSelectMultiple(cell, lastCell, flags, selectedIndex, isValid)
      } else {
        this.#onSelectSingle(cell, lastCell, flags, selectedIndex, isNeighbor, isValid)
      }
    }

    if (flags.includes(Cell.Flags.Path)) {
      flags.push(Cell.FlagsByName[cell.getDirection(lastCell)], Cell.Flags.Selected)
    }

    const lastPathItem = this.#getLastPathItem()
    if (lastPathItem) {
      // Update the visual anchor of selection to path.
      this.#update([lastPathItem.getIndex()])
      if (this.#selection.length && !flags.includes(Cell.Flags.Swap)) {
        this.#anchorSelection(lastPathItem)
      }
    }

    if (flags.length) {
      cell.update((state) => state.copy({ flags: state.getFlags().add(...flags) }))
      this.#dispatch(Grid.Events.Selection)
    }
  }

  #onSelectMultiple (cell, lastCell, flags, selectedIndex, isValid) {
    if (selectedIndex >= 0) {
      console.debug('SelectMultiple: Re-selecting a previously selected cell. De-select everything after it.')
      this.#deselect(this.#selection.splice(selectedIndex + 1))
    } else if (isValid) {
      console.debug('SelectMultiple: A valid new cell has been selected.')
      this.#selection.push(cell)
      flags.push(Cell.Flags.Path)
    } else {
      console.debug('SelectMultiple: Invalid cell selected. Ignoring.')
    }
  }

  #onSelectSingle (cell, lastCell, flags, selectedIndex, isNeighbor, isValid) {
    if (selectedIndex >= 0) {
      // An already selected cell was tapped.
      if (this.#selection.length === 1 && !cell.getFlags().has(Cell.Flags.Swapped)) {
        console.debug('SelectSingle: A non-swapped selected cell has been re-tapped. Mark for swap.')
        flags.push(Cell.Flags.Swap)
      } else {
        const lastSelectionIndex = this.#selection.length - 1
        if (this.#selection.length >= Word.minimumLength && selectedIndex === lastSelectionIndex) {
          console.debug('SelectSingle: Submitting selection for validation.')
          this.#validate()
        } else {
          console.debug('SelectSingle: Re-selecting a previously selected cell. De-select everything after it.')
          this.#deselect(this.#selection.splice(selectedIndex + 1))
        }
      }
    } else if (!isNeighbor) {
      if (this.#selection.length) {
        console.debug('SelectSingle: A non-neighboring cell has been selected. De-select everything else.')
        this.#deselect(this.#selection.splice(0))
      }
      this.#selection.push(cell)
      flags.push(Cell.Flags.Selected)
    } else if (isValid) {
      console.debug('SelectSingle: A valid new cell has been selected.')
      this.#selection.push(cell)
      flags.push(Cell.Flags.Path)
    } else {
      console.debug('SelectSingle: Invalid cell selected. Ignoring.')
    }
  }

  #onSwap (cell, lastCell, flags, selectedIndex, isMultiSelect) {
    if (isMultiSelect) {
      console.debug('Swap: Multiple target cells selected. De-selecting everything except source cell.')
      this.#deselect(this.#selection.splice(1))
    } else if (
      // User tapped a cell marked for swap or already swapped
      cell.getFlags().has(Cell.Flags.Swap, Cell.Flags.Swapped) ||
      // User tapped a cell with the same content as the cell marked for swap
      cell.getContent() === lastCell.getContent()
    ) {
      console.debug('Swap: Invalid target cell selected. Cancelling swap.')
      this.#deselect(this.#selection.splice(0))
    } else if (!cell.getFlags().has(Cell.Flags.Swapped)) {
      console.debug('Swap: Valid target cell selected. Initiating swap.')
      flags.push(Cell.Flags.Swap)
      this.#selection.push(cell)
    }
  }

  #setState (state) {
    this.#state.set(state)
    if (urlParams.has(Grid.Params.Solution.key)) {
      Grid.Params.Solution.set(state)
    }
  }

  #swap (source, target) {
    const state = this.#getState()
    const swap = [source.getIndex(), target.getIndex()]
    state.swaps.push(swap)

    // Update moves
    state.moves.push([Grid.Moves.Swap, state.swaps.length - 1].join(':'))

    this.#setState(state)
    this.#update(swap)
  }

  /**
   * This method is responsible for updating the state of cells belonging to the given indexes by examining the current
   * state of the grid.
   * @param indexes The indexes of the cells to update.
   */
  #update (indexes) {
    const state = this.#getState()
    const lastPathIndex = state.path.length - 1

    indexes.forEach((index) => {
      const cell = this.#cells[index]
      let content = state.configuration.cells[index].content
      const flags = new Flags()

      // Handle swapped cells
      const swap = state.swaps.find((indexes) => indexes.includes(index))
      if (swap) {
        flags.add(Cell.Flags.Swapped)
        const targetIndex = swap.indexOf(index) === 0 ? swap[1] : swap[0]
        content = state.configuration.cells[targetIndex].content
      }

      // Handle cells that are part of the path
      const pathIndex = state.path.indexOf(index)
      if (pathIndex >= 0) {
        flags.add(Cell.Flags.Path)

        const nextCellIndex = state.path[pathIndex + 1]
        if (nextCellIndex !== undefined) {
          // Link current cell to next cell
          const nextCell = this.#cells[nextCellIndex]
          flags.add(Cell.FlagsByName[cell.getDirection(nextCell)])
        }

        if (pathIndex === 0) {
          flags.add(Cell.Flags.First)
        }

        if (pathIndex === lastPathIndex) {
          if (lastPathIndex !== this.#pointerIndex && this.#pointerIndex >= 0) {
            // Remove flag from the old last path item
            this.#cells[this.#pointerIndex].update((state) =>
              state.copy({ flags: state.getFlags().remove(Cell.Flags.Last) }))
          }

          flags.add(Cell.Flags.Last)
        }

        // Handle cells that are part of a word
        const word = state.words.find((indexes) => indexes.includes(index))
        if (word) {
          flags.add(Cell.Flags.Validated)

          const lastWordIndex = word.length - 1
          // If the starting path index of the word is later in the path than the ending path index of the word, the
          // word was spelled in reverse
          const isReversed = state.path.indexOf(word[0]) > state.path.indexOf(word[lastWordIndex])
          const wordIndex = (isReversed ? Array.from(word).reverse() : word).indexOf(index)

          if (wordIndex === 0) {
            flags.add(Cell.Flags.WordStart)
          } else if (wordIndex === lastWordIndex) {
            flags.add(Cell.Flags.WordEnd)
          }
        }
      }

      cell.update((state) => state.copy({ content, flags }))
    })

    this.#pointerIndex = lastPathIndex

    // FIXME
    if (!this.isShareUrl) {
      // Update best score for local user only
      const statistics = this.getStatistics(state)
      if (statistics.score > state.best) {
        state.best = statistics.score
        this.#setState(state)
      }
    }

    this.#dispatch(Grid.Events.Update)
  }

  /**
   * Responsible for validating a selection of cells by index to see if the user has spelled a valid word.
   */
  #validate () {
    const pathIndexes = Grid.getIndexes(this.#selection)
    const lastPathItem = this.#getLastPathItem()
    if (lastPathItem) {
      // Make sure the selection can anchor to the existing path.
      const selectionAnchorIndex = this.#getSelectionAnchorIndex(lastPathItem)
      if (selectionAnchorIndex < 0) {
        console.debug('Unable to anchor selection to existing path.')
        pathIndexes.splice(0)
      } else if (selectionAnchorIndex !== 0) {
        console.debug('Anchoring selection at end.')
        // Reverse pathIndexes to ensure they get stored in state in the proper order.
        pathIndexes.reverse()
      } else {
        console.debug('Anchoring selection at beginning.')
      }
    }

    if (pathIndexes.length) {
      const wordCells = Array.from(this.#selection)
      let content = Grid.getContent(wordCells)
      if (!this.dictionary.isValid(content)) {
        // Try the selection in reverse
        content = Grid.getContent(wordCells.reverse())
      }

      if (this.dictionary.isValid(content)) {
        const state = this.#getState()

        // Path indexes correspond to the selection as it was anchored to the existing path
        state.path.push(...pathIndexes)

        // Word indexes correspond to the order in which the word was spelled
        state.words.push(Grid.getIndexes(wordCells))

        // Add the dictionary used to verify the word
        state.dictionary.push(this.dictionary.getSource(content))

        // Update moves
        state.moves.push([Grid.Moves.Spell, state.words.length - 1].join(':'))

        this.#setState(state)
      }
    }

    // If there is an existing last path item, include it in the update so it gets properly linked.
    const indexesToUpdate = lastPathItem ? pathIndexes.concat([lastPathItem.getIndex()]) : pathIndexes
    this.#deselect(this.#selection.splice(0))
    this.#update(indexesToUpdate)
  }

  static getContent (cells) {
    return cells.map((cell) => cell.getContent()).join('')
  }

  static getIndexes (cells) {
    return cells.map((cell) => cell.getIndex())
  }

  static getId () {
    const id = Grid.Params.Id.get()
    return (id === null || (Grid.DateRegex.test(id) && Date.parse(id) > Grid.Today)) ? Grid.DefaultId : id
  }

  static getMode () {
    const mode = Grid.Params.Mode.get()
    return Object.values(Grid.Modes).includes(mode) ? mode : Grid.DefaultMode
  }

  static getSolution (hash) {
    const solution = Grid.Params.Solution.get()
    if (solution?.hash === hash) {
      return solution
    }
  }

  static getWidth () {
    const width = Number(Grid.Params.Width.get())
    return Grid.Widths.includes(width) ? width : Grid.DefaultWidth
  }

  static Modes = Object.freeze({
    Casual: 'casual',
    Challenge: 'challenge'
  })

  static Name = 'grid'
  static ClassNames = Object.freeze({ Loading: getClassName(Grid.Name, 'loading') })
  static DateRegex = /^\d{4}-\d{2}-\d{2}$/
  static DefaultId = (() => {
    // The ID for the daily puzzle
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  })()
  static DefaultMode = Grid.Modes.Casual

  static DefaultWidth = 5
  static Events = Object.freeze({
    Selection: getClassName(Grid.Name, 'selection'),
    Update: getClassName(Grid.Name, 'update')
  })

  static Moves = Object.freeze({
    Spell: 'spell',
    Swap: 'swap'
  })

  static Params = Object.freeze({
    Debug: Cache.urlParams('debug'),
    Id: Cache.urlParams('id'),
    Mode: Cache.urlParams('mode'),
    Solution: new Cache(
      'solution',
      urlParams.get,
      (key, value) => {
        urlParams.set(key, value)
        history.pushState({ [key]: value }, '', url)
      },
      [Cache.Encoders.Base64, Cache.Encoders.Json]
    ),
    Width: Cache.urlParams('width')
  })

  static Today = Date.parse(Grid.DefaultId)
  static Widths = Object.freeze([5, 7, 9])

  static SelectionStart = class {
    event
    length

    constructor (event, length) {
      this.event = event
      this.length = length
    }
  }

  static Configuration = class {
    hash
    id
    maxColumn
    maxRow
    mode
    seed
    size
    width

    constructor () {
      this.id = Grid.getId()
      this.mode = Grid.getMode()
      this.width = Grid.getWidth()
      this.maxColumn = this.maxRow = this.width - 1
      this.size = this.width * this.width

      // Anything that influences the outcome of the grid should be passed in here
      this.seed = [this.mode, this.width, this.id].join(':')
      this.hash = cyrb53(this.seed)
    }

    getCoordinates (index) {
      return new Coordinates(this.getRow(index), this.getColumn(index), this.width)
    }

    getColumn (index) {
      return index % this.width
    }

    getIndex (coordinates) {
      return (coordinates.row * this.width) + coordinates.column
    }

    getRow (index) {
      return Math.floor(index / this.width)
    }

    isValid (coordinates) {
      return (
        coordinates.column >= 0 &&
        coordinates.column <= this.maxColumn &&
        coordinates.row >= 0 &&
        coordinates.row <= this.maxRow
      )
    }
  }

  static Generator = class {
    characters
    configuration
    dictionary
    rand
    wordBoundaries
    wordBoundaryIndexes
    words

    constructor (configuration, dictionary) {
      this.rand = splitmix32(configuration.hash)
      this.words = dictionary.getWords(this.rand, configuration.size)
      this.characters = this.words.reduce((characters, word) => characters.concat(word.split('')), [])
      this.configuration = configuration
      this.dictionary = dictionary
      this.wordBoundaries = Grid.Generator.getWordBoundaries(this.configuration.words)
      this.wordBoundaryIndexes = Object.keys(this.wordBoundaries).map(Number).sort((a, b) => a - b)
    }

    /**
     * Generate grid state configuration.
     * @returns {Grid.State.Configuration}
     */
    generate () {
      throw new Error('Use concrete implementation')
    }

    /**
     *
     * @param words
     * @returns {{[p: string]: any}}
     */
    static getWordBoundaries (words) {
      return Object.fromEntries(words.reduce((entries, word, index) => {
        const [previousBoundary] = entries[entries.length - 1] ?? [-1]
        entries.push([previousBoundary + word.length, index])
        return entries
      }, []))
    }
  }

  static State = class {
    configuration
    solution
    user

    constructor (configuration, solution, user) {
      this.configuration = configuration
      this.solution = solution
      this.user = user
    }

    // TODO consider storing the score of the path
    static Configuration = class {
      cells
      words

      constructor (cells, words) {
        this.cells = cells
        this.words = words
      }
    }

    static Solution = class {
      hash
      moves
      path
      sources
      swaps
      words

      constructor (hash, path, moves, swaps, words, sources) {
        this.hash = hash
        this.path = path ?? []
        this.moves = moves ?? []
        this.swaps = swaps ?? []
        this.words = words ?? []
        this.sources = sources ?? []
      }
    }

    static User = class {
      highScore

      constructor (highScore) {
        this.highScore = highScore
      }
    }

    static Keys = Object.freeze({
      Configuration: 'configuration',
      Solution: 'solution',
      User: 'user'
    })
  }

  static Rating = class {
    description
    emoji

    constructor (description, emoji) {
      this.description = description
      this.emoji = emoji
    }
  }

  static Statistics = class {
    averageWordLength
    best
    bestDiff
    moves
    progress
    rating
    score
    swapCount
    wordCount

    constructor (state, words, size) {
      const { length, points } = words.reduce(
        (acc, word) => ({ length: acc.length + word.content.length, points: acc.points + word.points }),
        { length: 0, points: 0 }
      )

      const score = points + (length === size ? size : 0)
      const diff = state.best - score

      this.averageWordLength = length === 0 ? 0 : (length / words.length).toPrecision(2)
      this.best = state.best
      this.bestDiff = diff === 0 ? '=' : (diff < 0 ? diff : `+${diff}`)
      this.moves = state.moves.map((move) => move.split(':')[0])
      this.progress = Math.trunc((state.path.length / size) * 100)
      this.score = score
      const ratingIndex = Math.min(Grid.Statistics.Ratings.length - 1, Math.floor(this.score / size))
      this.rating = points === 69 ? new Grid.Rating('Heh', '😏') : Grid.Statistics.Ratings[ratingIndex]
      this.swapCount = state.swaps.length
      this.wordCount = words.length
    }

    static Ratings = Object.freeze([
      new Grid.Rating('Hmm', '🤔'),
      new Grid.Rating('Meh', '😐'),
      new Grid.Rating('Whew', '😅'),
      new Grid.Rating('Great', '🥳'),
      new Grid.Rating('Wow', '🤯')
    ])
  }
}

const $gridSizeMultipliers = document.getElementById('grid-size-multipliers')

Grid.Widths.forEach((width) => {
  const $li = document.createElement('li')
  $li.textContent = `${width}x${width} = ${Word.widthMultiplier(width)}`
  $gridSizeMultipliers.append($li)
})
