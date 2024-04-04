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
  #size
  #state
  #tapped = []
  #width

  constructor (id, width) {
    this.#id = id
    this.#width = Grid.Widths.includes(Number(width)) ? width : Grid.DefaultWidth
    this.#size = this.#width * this.#width
    this.#seed = Grid.cyrb53([this.#id, this.#width].join(','))
    this.#rand = Grid.splitmix32(this.#seed)
    this.#state = new State(new Grid.State({ seed: this.#seed }), this.#seed)

    document.body.className = `grid-${this.#width}`
    $grid.classList.add(Grid.ClassNames.Grid)

    const indexes = []
    for (let index = 0; index < this.#size; index++) {
      const row = Math.floor(index / this.#width)
      const column = index % this.#width
      const letter = this.#nextLetter()
      const configuration = new Cell.State(index, letter.character)
      this.#configuration.push(configuration)
      this.#cells.push(new Cell(new Coordinates(row, column), configuration))
      indexes.push(index)
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

  reset () {
    this.#state.set(new Grid.State({ seed: this.#seed }))
    this.#update(Grid.getIndexes(this.#cells))
  }

  #deselect (cells) {
    cells.forEach((cell) => cell.update((state) => {
      const flags = new Flags()
      if (state.getFlags().has(Cell.Flags.Swapped)) {
        flags.add(Cell.Flags.Swapped)
      }
      return state.copy({ flags })
    }))
  }

  #getState () {
    return new Grid.State(this.#state.get())
  }

  #nextLetter () {
    const weight = this.#rand()
    return letters.find((letter) => letter.weight > weight)
  }

  #onSelect (event) {
    const cell = event.detail.cell
    if (cell.getFlags().has(Cell.Flags.Validated)) {
      // These cells cannot be selected
      return
    }

    // TODO: also check for already validated cell to prevent path from crossing
    const index = this.#selection.findIndex((selected) => selected.equals(cell))
    if (index > -1) {
      // Going back to an already selected cell, remove everything selected after it
      this.#deselect(this.#selection.splice(index + 1))
      return
    }

    const flags = [Cell.Flags.Selected]
    const length = this.#selection.length
    if (length > 0) {
      flags.push(Cell.Flags.Path)
      const previousCell = this.#selection[length - 1]
      if (previousCell?.isNeighbor(cell)) {
        flags.push(Cell.FlagsByName[cell.getCoordinates().getDirection(previousCell.getCoordinates())])
      }
    }

    cell.update((state) => state.copy({ flags: state.getFlags().add(...flags) }))

    this.#selection.push(cell)
  }

  #onPointerUp () {
    const indexes = []
    const length = this.#selection.length
    if (length === 0) {
      // User has not selected a cell. De-select anything that was previously tapped.
      indexes.push(...Grid.getIndexes(this.#tapped))
      this.#tapped = []
    } else if (length === 1) {
      const tapped = this.#selection[0]
      if (tapped.getFlags().has(Cell.Flags.Swapped)) {
        // User has tapped a cell that has already been swapped. Ignore.
        indexes.push(tapped.getIndex())
      } else if (this.#tapped.some((existing) => existing.equals(tapped))) {
        // User has tapped an already tapped cell. De-select it.
        indexes.push(tapped.getIndex())
        this.#tapped = []
      } else {
        this.#tapped.push(tapped)
      }

      if (this.#tapped.length === 2) {
        // User has tapped two unique cells. Swap them.
        indexes.push(...Grid.getIndexes(this.#tapped))
        this.#swap(...this.#tapped)
        this.#tapped = []
      }
    } else {
      // User has selected multiple cells. Validate them to see if a word has been spelled.
      indexes.push(...Grid.getIndexes(this.#selection))
      this.#validate(indexes)
      this.#tapped = []
    }

    this.#update(indexes)
    this.#selection = []
  }

  #swap (source, target) {
    const state = this.#getState()
    const swap = [source.getIndex(), target.getIndex()]
    const unswap = Array.from(swap).reverse()
    const unswapIndex = state.swaps.findIndex((swap) => swap.every((value, index) => unswap[index] === value))

    if (unswapIndex < 0) {
      state.swaps.push(swap)
    } else {
      state.swaps.splice(unswapIndex, 1)
    }

    this.#state.set(state)
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
      let content = cell.getContent()
      const flags = new Flags()

      // Handle tapped cells
      if (this.#tapped.some((tapped) => tapped.equals(cell))) {
        flags.add(Cell.Flags.Selected)
      }

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

    document.dispatchEvent(new CustomEvent(Grid.Events.Update))
  }

  /**
   * Responsible for validating a selection of cells by index to see if the user has spelled a valid word.
   */
  #validate (indexes) {
    const state = this.#getState()
    const lastCellIndex = state.path[state.path.length - 1]
    const lastSelectionIndex = this.#selection.length - 1

    if (lastCellIndex !== undefined) {
      const last = this.#cells[lastCellIndex]
      const neighborIndex = [0, lastSelectionIndex].find((index) => last.isNeighbor(this.#selection[index]))
      if (neighborIndex === undefined) {
        console.debug('Selection does not start or begin as a neighbor of an existing path item, ignoring')
        return
      } else if (neighborIndex === lastSelectionIndex) {
        console.debug('Selection drawn in reverse')
        // Selection was drawn in reverse
        indexes.reverse()
      }
    }

    let word = Grid.getWord(this.#selection)
    if (!Word.isValid(word)) {
      // Try the selection in reverse
      word = Grid.getWord(this.#selection.reverse())
    }

    if (Word.isValid(word)) {
      // Path indexes are pushed in relative distance to the last neighbor
      state.path.push(...indexes)
      // Word indexes are pushed in the correct order to spell the word
      state.words.push(Grid.getIndexes(this.#selection))
      this.#state.set(state)

      if (lastCellIndex !== undefined) {
        // When adding to an existing path, also update the previous last cell. This will allow the cell to be linked
        // to the newly added cells.
        indexes.push(lastCellIndex)
      }
    }
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

  static getWord (cells) {
    return cells.map((cell) => cell.getContent()).join('')
  }

  static getIndexes (cells) {
    return cells.map((cell) => cell.getIndex())
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
  static ClassNames = Object.freeze({ Grid: Grid.Name })
  static DefaultWidth = 5
  static Events = Object.freeze({ Update: getClassName(Grid.Name, 'update') })
  static Widths = Object.freeze([5, 7, 9])

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
