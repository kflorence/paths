import { Cell } from './cell'
import { lettersByWeight } from './letters'
import { Coordinates } from './coordinates'

export class Grid {
  #$element = document.getElementById('grid')

  #cells = []
  #id
  #rand
  #size
  #seed
  #state = []
  #width

  constructor (id, width) {
    this.#id = id
    this.#width = Grid.Widths.includes(Number(width)) ? width : Grid.DefaultWidth
    this.#size = this.#width * this.#width
    this.#seed = Grid.cyrb53([this.#id, this.#width].join(','))
    this.#rand = Grid.splitmix32(this.#seed)

    document.body.className = `grid-${this.#width}`
    this.#$element.classList.add(Grid.ClassNames.Grid)

    for (let index = 0; index < this.#size; index++) {
      const row = Math.floor(index / this.#width)
      const column = index % this.#width
      const state = new Cell.State(index, this.#nextLetter())
      this.#state.push(state)
      this.#cells.push(new Cell(new Coordinates(row, column), state))
    }

    this.#$element.replaceChildren(...this.#cells.map((cell) => cell.getElement()))
  }

  find ($cell) {
    return this.#cells[this.findIndex($cell)]
  }

  findIndex ($cell) {
    return this.#cells.findIndex((cell) => cell.getElement() === $cell)
  }

  getElement () {
    return this.#$element
  }

  getSeed () {
    return this.#seed
  }

  reset () {
    this.#cells.forEach((cell, index) => cell.update(this.#state[index]))
  }

  swap (sourceCell, targetCell) {
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

  update (state) {

  }

  #nextLetter () {
    const next = this.#rand()
    return Grid.LettersByWeight.find(([, weight]) => weight > next)[0]
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
}
