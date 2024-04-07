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
  #cells = []
  #configuration = []
  #eventListeners = new EventListeners({ context: this, element: $grid })
  #id
  #pointerIndex = -1
  #rand
  #seed
  #selection = []
  #selectionStart
  #size
  #state
  #width

  constructor (id, width) {
    this.#id = id
    this.#width = Grid.Widths.includes(Number(width)) ? width : Grid.DefaultWidth
    this.#size = this.#width * this.#width
    this.#seed = Grid.cyrb53([this.#id, this.#width].join(','))
    this.#rand = Grid.splitmix32(this.#seed)
    this.#state = new State(new Grid.State({ seed: this.#seed }), this.#seed)

    $grid.dataset.width = this.#width

    const indexes = []
    for (let index = 0; index < this.#size; index++) {
      indexes.push(index)

      const row = Math.floor(index / this.#width)
      const column = index % this.#width
      const coordinates = new Coordinates(row, column, this.#width)
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
    this.#state.set(state)

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

    this.#state.set(state)

    const lastPathItemIndex = state.path[state.path.length - 1]
    if (lastPathItemIndex !== undefined) {
      // Also update the last path item so the link can be removed.
      indexes.push(lastPathItemIndex)
    }

    this.#update(indexes)

    return this.getWords()
  }

  reset () {
    this.#state.set(new Grid.State({ seed: this.#seed }))
    this.#update(Grid.getIndexes(this.#cells))
  }

  #deselect (selection) {
    selection.forEach((cell) => cell.reset())
    const detail = { selection: Array.from(this.#selection) }
    document.dispatchEvent(new CustomEvent(Grid.Events.Update, { detail }))
  }

  #getState () {
    return new Grid.State(this.#state.get())
  }

  #nextLetter () {
    const weight = this.#rand()
    return letters.find((letter) => letter.weight > weight)
  }

  #onPointerUp () {
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

    // User is doing a multi-select if multiple onSelect events have been fired before pointerup resets selectionStart.
    const isMultiSelect = this.#selectionStart !== undefined
    if (!isMultiSelect) {
      // The first selection event, assume it's a tap.
      this.#selectionStart = new Grid.SelectionStart(event, this.#selection.length)
    }

    const flags = [Cell.Flags.Selected]
    const length = this.#selection.length
    const lastSelectionIndex = length - 1

    const selectedIndex = this.#selection.findIndex((selected) => selected.equals(cell))
    if (selectedIndex >= 0) {
      // An already selected cell was selected again.
      if (length > 1) {
        // User has multiple cells selected.
        if (selectedIndex === lastSelectionIndex) {
          // User tapped the last selected cell.
          if (!isMultiSelect) {
            // Only validate on tap, not multi-select, which will be validated on pointerup.
            this.#validate()
          }
        } else {
          // User tapped a previous cell. De-select everything after the selected cell.
          this.#deselect(this.#selection.splice(selectedIndex + 1))
        }

        return
      } else if (!isMultiSelect) {
        // User has re-tapped a single, selected cell.
        if (cell.getFlags().has(Cell.Flags.Swap, Cell.Flags.Swapped)) {
          // User tapped a cell marked for swap, or already swapped. De-select it.
          this.#deselect(this.#selection.splice(0))
          // Nothing more to do.
          return
        } else {
          flags.push(Cell.Flags.Swap)
        }
      }
    }

    if (length > 0 && !flags.some((flag) => flag === Cell.Flags.Swap)) {
      const lastSelectedCell = this.#selection[lastSelectionIndex]
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

    cell.update((state) => state.copy({ flags: state.getFlags().add(...flags) }))

    if (selectedIndex < 0) {
      // Don't allow duplicates, e.g. when the same cell is selected again.
      this.#selection.push(cell)
      const detail = { selection: Array.from(this.#selection) }
      document.dispatchEvent(new CustomEvent(Grid.Events.Update, { detail }))
    }
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

    this.#state.set(state)
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

    const detail = { words: this.getWords() }
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
      this.#state.set(state)

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
  static ClassNames = Object.freeze({ Valid: 'valid' })
  static DefaultWidth = 5
  static Events = Object.freeze({ Update: getClassName(Grid.Name, 'update') })
  static Widths = Object.freeze([5, 7, 9])

  static SelectionStart = class {
    event
    length

    constructor (event, length) {
      this.event = event
      this.length = length
    }
  }

  static State = class {
    path
    seed
    swaps
    words

    constructor (state) {
      this.path = state.path ?? []
      this.seed = state.seed
      this.swaps = state.swaps ?? []
      this.words = state.words ?? []
    }
  }
}
