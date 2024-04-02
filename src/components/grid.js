import { Cell } from './cell'
import { lettersByWeight } from './letters'
import { Coordinates } from './coordinates'
import { State } from './state'
import { EventListeners } from './eventListeners'
import { Dictionary } from './dictionary'
import { Flags } from './flag'

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
  #tapped
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
      const configuration = new Cell.State(index, this.#nextLetter())
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

  find ($cell) {
    return this.#cells[this.findIndex($cell)]
  }

  findIndex ($cell) {
    return this.#cells.findIndex((cell) => cell.getElement() === $cell)
  }

  reset () {
    this.#cells.forEach((cell, index) => cell.update(this.#configuration[index]))
    this.#state.set(new Grid.State({ seed: this.#seed }))
  }

  #deselect (cells) {
    cells.forEach((cell) => cell.update((state) => state.getFlags().remove(Cell.Flags.Selected)))
  }

  #getState () {
    return new Grid.State(this.#state.get())
  }

  #nextLetter () {
    const next = this.#rand()
    return Grid.LettersByWeight.find(([, weight]) => weight > next)[0]
  }

  #onSelect (event) {
    console.log('onSelect', event)
    const cell = event.detail.cell
    const index = this.#selection.findIndex((selected) => selected.equals(cell))
    if (index > -1) {
      // Going back to an already selected cell, remove everything selected after it
      this.#deselect(this.#selection.splice(index + 1))
      return
    }

    const flags = [Cell.Flags.Selected]
    const lastSelectedCell = this.#selection[this.#selection.length - 1]
    if (lastSelectedCell && lastSelectedCell.isNeighbor(cell)) {
      flags.push(Cell.FlagsByName[lastSelectedCell.getCoordinates().getDirection(cell.getCoordinates())])
    }

    cell.update((state) => state.copy({ flags: state.getFlags().add(...flags) }))

    this.#selection.push(cell)
  }

  #onPointerUp () {
    const indexes = this.#selection.map((cell) => cell.getIndex())
    const length = this.#selection.length
    if (length === 1) {
      if (this.#tapped) {
        this.#swap(this.#tapped, this.#selection[0])
        this.#tapped = undefined
      } else {
        this.#tapped = this.#selection[0]
      }
    } else if (length > 1) {
      this.#validate(indexes)
    }

    this.#update(indexes)

    this.#selection = []
  }

  #swap (sourceCell, targetCell) {
    const sourceState = sourceCell.getState()
    const sourceStateOriginal = this.#state[sourceCell.getIndex()]
    const targetState = targetCell.getState()
    const targetStateOriginal = this.#state[targetCell.getIndex()]

    sourceCell.setState(sourceState.copy({
      content: targetState.content,
      flags: sourceState.flags[
        // If setting back to original value, remove 'swapped' flag, otherwise add it
        sourceStateOriginal.content === targetState.content ? 'remove' : 'add'](Cell.Flags.Swapped)
    }))

    targetCell.setState(targetState.copy({
      content: sourceState.content,
      flags: targetState.flags[
        // If setting back to original value, remove 'swapped' flag, otherwise add it
        targetStateOriginal.content === sourceState.content ? 'remove' : 'add'](Cell.Flags.Swapped)
    }))
  }

  #update (indexes) {
    const state = this.#getState()
    const lastPathIndex = state.path.length - 1

    // TODO: swapped cells
    indexes.forEach((index) => {
      const cell = this.#cells[index]
      const flags = new Flags()

      // Handle cells that are part of the path
      const pathIndex = state.path.indexOf(index)
      if (pathIndex >= 0) {
        const previousPathIndex = pathIndex - 1
        if (previousPathIndex >= 0) {
          // Link this cell to the previous cell
          const previousCell = this.#cells[state.path[previousPathIndex]]
          flags.add(Cell.FlagsByName[cell.getCoordinates().getDirection(previousCell.getCoordinates())])
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
      }

      const word = state.words.find((indexes) => indexes.includes(index))
      if (word) {
        flags.add(Cell.Flags.Validated)

        const wordIndex = word.indexOf(index)
        if (wordIndex === 0) {
          flags.add(Cell.Flags.WordStart)
        } else if (wordIndex === word.length - 1) {
          flags.add(Cell.Flags.WordEnd)
        }
      }

      cell.update((state) => state.copy({ flags }))
    })

    this.#pointerIndex = lastPathIndex
  }

  #validate (indexes) {
    const state = this.#getState()
    const lastPathIndex = state.path.length - 1
    const lastSelectionIndex = this.#selection.length - 1

    if (lastPathIndex >= 0) {
      const index = [0, lastSelectionIndex].find((index) =>
        this.#cells[lastPathIndex].isNeighbor(this.#selection[index]))
      if (!index) {
        // Selection does not start or begin as a neighbor of an existing path item
        return
      } else if (index === lastSelectionIndex) {
        // Selection was drawn in reverse
        this.#selection.reverse()
      }
    }

    // Accept words spelled backwards or forwards
    const words = [Grid.getWord(this.#selection), Grid.getWord(Array.from(this.#selection).reverse())]
    if (words.some((word) => Dictionary.isValid(word))) {
      state.path.push(...indexes)
      state.words.push(indexes)
      this.#state.set(state)
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

  // https://github.com/bryc/code/blob/master/jshash/PRNGs.md
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

  static ClassNames = Object.freeze({ Grid: 'grid' })
  static DefaultWidth = 5
  static LettersByWeight = Object.entries(lettersByWeight)
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
