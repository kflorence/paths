import { Cell } from './cell'
import { Coordinates } from './coordinates'
import { State } from './state'
import { EventListeners } from './eventListeners'
import { Word } from './word'
import { Flags } from './flag'
import { getClassName } from './util'
import { letters } from './letter'

const $grid = document.getElementById('grid')

export class Grid {
  id
  width

  #active
  #cells = []
  #configuration = []
  #eventListeners = new EventListeners({ context: this, element: $grid })
  #pointerIndex = -1
  #rand
  #seed
  #selection = []
  #selectionStart
  #size
  #state

  constructor () {
    const state = Grid.#State.fromParams()

    this.id = state.id
    this.width = state.width
    this.#size = this.width * this.width
    this.#seed = state.getSeed()
    this.#rand = Grid.splitmix32(this.#seed)

    this.#state = new State(
      this.#seed,
      state,
      [new State.Param(this.#seed, State.Params.State, true, true)],
      State.params.has(State.Params.State)
    )

    const seed = this.#getState().getSeed()
    if (seed !== this.#seed) {
      console.warn(`Ignoring shared state due to seed mismatch. Theirs: ${seed}. Ours: ${this.#seed}.`)
      State.params.delete(this.#seed)
      this.#state = new State(this.#seed, state)
    }

    $grid.dataset.width = this.width

    const indexes = []
    for (let index = 0; index < this.#size; index++) {
      indexes.push(index)

      const row = Math.floor(index / this.width)
      const column = index % this.width
      const coordinates = new Coordinates(row, column, this.width)
      const letter = this.#nextLetter()
      const configuration = new Cell.State(index, letter.character)
      const cell = new Cell(coordinates, configuration)

      this.#cells.push(cell)
      this.#configuration.push(configuration)
    }

    this.#update(indexes)

    $grid.replaceChildren(...this.#cells.map((cell) => cell.getElement()))

    this.#eventListeners.add([
      { type: Cell.Events.Select, handler: this.#onSelect },
      { type: 'pointerup', element: document, handler: this.#onPointerUp }
    ])
  }

  getSelection () {
    return Array.from(this.#selection)
  }

  getState () {
    return State.encode(JSON.stringify(this.#state.get()))
  }

  getStatistics () {
    return new Grid.Statistics(this.#getState())
  }

  getSwaps () {
    return this.#getState().swaps.map((indexes) => indexes.map((index) => {
      const cell = this.#cells[index]
      const content = this.#configuration[index].content
      const coordinates = cell.getCoordinates().toString()
      return `${content} (${coordinates})`
    }))
  }

  getWords () {
    return this.#getState().words.map((indexes) => new Word(indexes.map((index) => this.#cells[index])))
  }

  removeSwap (index) {
    const state = this.#getState()

    // Remove the swap
    const swap = state.swaps.splice(index, 1)[0]
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
    const indexes = state.path.splice(earliestPathIndex)

    this.#setState(state)

    const lastPathItemIndex = state.path[state.path.length - 1]
    if (lastPathItemIndex !== undefined) {
      // Also update the last path item so the link can be removed.
      indexes.push(lastPathItemIndex)
    }

    this.#update(indexes)
  }

  reset () {
    this.#setState(new Grid.#State(this.id, this.width))
    this.#update(Grid.getIndexes(this.#cells))
  }

  #deselect (selection) {
    selection.forEach((cell) => cell.reset())
    const detail = { selection: this.getSelection() }
    document.dispatchEvent(new CustomEvent(Grid.Events.Selection, { detail }))
  }

  #getState () {
    return Grid.#State.fromState(this.#state.get())
  }

  #nextLetter () {
    const weight = this.#rand()
    return letters.find((letter) => letter.weight > weight)
  }

  #onPointerUp () {
    if (this.#active) {
      this.#active.update((state) => state.copy({ flags: state.getFlags().remove(Cell.Flags.Active) }))
      this.#active = undefined
    }

    if (!this.#selectionStart) {
      // User clicked outside the grid area. De-select anything that was selected.
      this.#deselect(this.#selection.splice(0))
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
    const cell = event.detail.cell
    if (cell.getFlags().has(Cell.Flags.Validated)) {
      // These cells cannot be selected
      return
    }

    const flags = [Cell.Flags.Active]
    this.#active = cell

    // User is doing a multi-select if multiple onSelect events have been fired before pointerup resets selectionStart.
    const isMultiSelect = this.#selectionStart !== undefined
    if (!isMultiSelect) {
      // The first selection event, assume it's a tap.
      this.#selectionStart = new Grid.SelectionStart(event, this.#selection.length)
    }

    const selectedIndex = this.#selection.findIndex((selected) => selected.equals(cell))
    if (selectedIndex >= 0) {
      // An already selected cell was selected again.
      if (this.#selection.length > 1) {
        // User has multiple cells selected.
        if (selectedIndex === this.#selection.length - 1) {
          // User tapped the last selected cell.
          if (!isMultiSelect) {
            // Only validate on tap, not multi-select, which will be validated on pointerup.
            this.#validate()
          }
        } else {
          // User tapped a previous cell. De-select everything after the selected cell.
          this.#deselect(this.#selection.splice(selectedIndex + 1))
        }
      } else if (!isMultiSelect) {
        // User has re-tapped a single, selected cell.
        if (cell.getFlags().has(Cell.Flags.Swap, Cell.Flags.Swapped)) {
          // User tapped a cell marked for swap, or already swapped. De-select it.
          this.#deselect(this.#selection.splice(0))
        } else {
          flags.push(Cell.Flags.Swap)
        }
      }
    } else {
      flags.push(Cell.Flags.Selected)

      if (this.#selection.length > 0 && !flags.some((flag) => flag === Cell.Flags.Swap)) {
        const lastSelectedCell = this.#selection[this.#selection.length - 1]
        if (lastSelectedCell.getFlags().has(Cell.Flags.Swap)) {
          // Previous cell was marked for swap. Mark the new cell for swap.
          flags.push(Cell.Flags.Swap)
        } else {
          // Not dealing with a swap.
          const cellCoordinates = cell.getCoordinates()
          const cellNeighbors = cellCoordinates.getNeighbors()
          const lastSelectedCellCoordinates = lastSelectedCell.getCoordinates()

          const isNeighbor = cellNeighbors.some((neighbor) => neighbor.coordinates.equals(lastSelectedCellCoordinates))
          if (isNeighbor) {
            // Selected cell is a neighbor of the last selected cell.
            const state = this.#getState()
            const direction = cellCoordinates.getDirection(lastSelectedCellCoordinates)
            const occupiedDirections = cellNeighbors
              .filter((neighbor) => state.path.includes(neighbor.index))
              .map((neighbor) => neighbor.direction)
            if (Coordinates.isCrossing(direction, occupiedDirections)) {
              // Selected path would cross existing path. Selection is invalid.
              return
            } else {
              flags.push(Cell.Flags.Path, Cell.FlagsByName[direction])
            }
          } else if (isMultiSelect) {
            // Selected cell is not a neighbor, since this is a multi-select, just ignore it.
            return
          } else {
            // A non-neighbor cell was tapped. De-select anything previously selected.
            this.#deselect(this.#selection.splice(0))
          }
        }
      }

      this.#selection.push(cell)

      const detail = { selection: this.getSelection() }
      document.dispatchEvent(new CustomEvent(Grid.Events.Selection, { detail }))
    }

    cell.update((state) => state.copy({ flags: state.getFlags().add(...flags) }))
  }

  #setState (state) {
    this.#state.set(state)
  }

  #swap (source, target) {
    const state = this.#getState()
    const swap = [source.getIndex(), target.getIndex()]
    const unswap = Array.from(swap).reverse()

    // Check to see if this is an un-swap
    const unswapIndex = state.swaps.findIndex((swap) => swap.every((value, index) => unswap[index] === value))

    if (unswapIndex < 0) {
      state.swaps.push(swap)
    } else {
      state.swaps.splice(unswapIndex, 1)
    }

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
      let content = this.#configuration[index].content
      const flags = new Flags()

      // Handle swapped cells
      const swap = state.swaps.find((indexes) => indexes.includes(index))
      if (swap) {
        flags.add(Cell.Flags.Swapped)
        const targetIndex = swap.indexOf(index) === 0 ? swap[1] : swap[0]
        content = this.#configuration[targetIndex].content
      }

      // Handle cells that are part of the path
      const pathIndex = state.path.indexOf(index)
      if (pathIndex >= 0) {
        flags.add(Cell.Flags.Path)

        const nextCellIndex = state.path[pathIndex + 1]
        if (nextCellIndex !== undefined) {
          // Link current cell to next cell
          const nextCell = this.#cells[nextCellIndex]
          flags.add(Cell.FlagsByName[cell.getCoordinates().getDirection(nextCell.getCoordinates())])
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

    const detail = { swaps: this.getSwaps(), words: this.getWords() }
    document.dispatchEvent(new CustomEvent(Grid.Events.Update, { detail }))
  }

  /**
   * Responsible for validating a selection of cells by index to see if the user has spelled a valid word.
   */
  #validate () {
    const selection = Array.from(this.#selection)
    const indexes = Grid.getIndexes(selection)

    // Empty the selection
    this.#selection = []

    const state = this.#getState()
    const lastPathItemIndex = state.path[state.path.length - 1]
    const lastSelectionIndex = selection.length - 1

    if (lastPathItemIndex !== undefined) {
      const lastCell = this.#cells[lastPathItemIndex]
      const neighborIndex = [0, lastSelectionIndex].find((index) => lastCell.isNeighbor(selection[index]))
      if (neighborIndex === undefined) {
        console.debug('Selection does not start or begin as a neighbor of an existing path item, ignoring')
        this.#deselect(selection)
        return
      } else if (neighborIndex === lastSelectionIndex) {
        console.debug('Selection drawn in reverse')
        // Selection was drawn in reverse
        indexes.reverse()
      }
    }

    let content = Grid.getContent(selection)
    if (!Word.isValid(content)) {
      // Try the selection in reverse
      content = Grid.getContent(selection.reverse())
    }

    if (Word.isValid(content)) {
      // Path indexes are pushed in relative distance to the last neighbor
      state.path.push(...indexes)
      // Word indexes are pushed in the correct order to spell the word
      state.words.push(Grid.getIndexes(selection))
      this.#setState(state)

      if (lastPathItemIndex !== undefined) {
        // When adding to an existing path, also update the previous last cell. This will allow the cell to be linked
        // to the newly added cells.
        indexes.push(lastPathItemIndex)
      }
    }

    this.#update(indexes)
  }

  /**
   * cyrb53 (c) 2018 bryc (github.com/bryc)
   * License: Public domain. Attribution appreciated.
   * A fast and simple 53-bit string hash function with decent collision resistance.
   * Largely inspired by MurmurHash2/3, but with a focus on speed/simplicity.
   */
  static cyrb53 = function (str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed; let h2 = 0x41c6ce57 ^ seed
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i)
      h1 = Math.imul(h1 ^ ch, 2654435761)
      h2 = Math.imul(h2 ^ ch, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return 4294967296 * (2097151 & h2) + (h1 >>> 0)
  }

  static getIndexes (cells) {
    return cells.map((cell) => cell.getIndex())
  }

  static getContent (cells) {
    return cells.map((cell) => cell.getContent()).join('')
  }

  /**
   * A seeded pseudo-random number generator.
   * @see https://github.com/bryc/code/blob/master/jshash/PRNGs.md
   * @param a the seed value
   * @returns {function(): *} a function which generates static pseudo-random numbers per seed and call
   */
  static splitmix32 (a) {
    return function () {
      a |= 0
      a = a + 0x9e3779b9 | 0
      let t = a ^ a >>> 16
      t = Math.imul(t, 0x21f0aaad)
      t = t ^ t >>> 15
      t = Math.imul(t, 0x735a2d97)
      return ((t ^ t >>> 15) >>> 0) / 4294967296
    }
  }

  static Name = 'grid'
  static DefaultId = (() => {
    // The ID for the daily puzzle
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  })()

  static DefaultWidth = 5
  static Events = Object.freeze({
    Selection: getClassName(Grid.Name, 'selection'),
    Update: getClassName(Grid.Name, 'update')
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

  static #State = class {
    id
    path
    swaps
    width
    words

    constructor (id, width, path, swaps, words) {
      this.id = id
      this.width = Number(width)
      if (!Grid.Widths.includes(this.width)) {
        this.width = Grid.DefaultWidth
      }

      this.path = path ?? []
      this.swaps = swaps ?? []
      this.words = words ?? []
    }

    getSeed () {
      return Grid.cyrb53([this.id, this.width].join(','))
    }

    static fromParams () {
      let id = State.params.get(State.Params.Id)
      if (id !== null) {
        const date = Date.parse(id)
        if (!isNaN(date) && date > Grid.Today) {
          console.debug('The provided ID is for a future date, defaulting to the ID for today.', id)
          id = Grid.DefaultId
        }
      } else {
        id = Grid.DefaultId
      }

      const width = State.params.get(State.Params.Width)
      return new Grid.#State(id, width)
    }

    static fromState (state) {
      return new Grid.#State(state.id, state.width, state.path, state.swaps, state.words)
    }
  }

  static Statistics = class {
    averageWordLength
    progress
    swapCount
    wordCount

    constructor (state) {
      this.averageWordLength = state.words.length
        ? (state.words.reduce((sum, word) => sum + word.length, 0) / state.words.length).toPrecision(2)
        : 0
      this.progress = Math.trunc((state.path.length / (state.width * state.width)) * 100)
      this.swapCount = state.swaps.length
      this.wordCount = state.words.length
    }
  }
}
