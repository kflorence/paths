import { Cell } from './cell'
import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'
import { lettersByWeight } from './letters'

export class Grid extends Stateful {
  $element = document.getElementById('grid')

  cells = []
  selected = []
  width

  #eventListeners = new EventListeners({ context: this, element: this.$element })
  #pointerDownEvent

  constructor (parent, state, width) {
    super(state)

    this.parent = parent
    this.width = width
  }

  deselect () {
    this.#pointerDownEvent = undefined

    if (this.hasSelected()) {
      this.parent.select(this.selected)
      this.selected = []
    }

    this.update()
  }

  getLastSelected () {
    return this.selected[this.selected.length - 1]
  }

  hasSelected () {
    return this.selected.length > 0
  }

  select (cell) {
    if (!this.#pointerDownEvent || cell.hasClassName(Cell.ClassNames.Word)) {
      // Can't select a cell that is already part of a word
      return
    }

    const index = this.selected.findIndex((selected) => selected.equals(cell))
    if (index > -1) {
      // Going back to an already selected cell, remove everything selected after it
      this.selected.splice(index + 1).forEach((cell) => cell.reset())
      return
    }

    const lastSelected = this.getLastSelected()
    const last = lastSelected ?? this.parent.getLastSelected()
    if (last && !last.getNeighbor(cell)) {
      return
    }

    cell.select(lastSelected)
    this.selected.push(cell)
    this.update()
  }

  setup () {
    this.#teardown()

    document.body.className = `grid-${this.width}`
    this.$element.classList.add(Grid.ClassNames.Grid)

    this.getState().forEach((state, index) => {
      const row = Math.floor(index / this.width)
      const column = index % this.width
      const cell = new Cell(this, state, { row, column })
      this.$element.append(cell.$element)
      this.cells.push(cell)
    })

    this.#eventListeners.add([{ handler: this.#onPointerDown, type: 'pointerdown' }])

    this.update()
  }

  update () {
    this.updateState(() => this.cells.map((cell) => cell.getState()))
    this.parent.update()
  }

  #teardown () {
    this.#eventListeners.remove()

    this.cells.forEach((cell) => cell.teardown())
    this.cells = []

    this.$element.replaceChildren()
    this.$element.className = ''
  }

  #onPointerDown (event) {
    this.#pointerDownEvent = event

    const closest = event.target.closest('.cell')
    const cell = this.cells.find((cell) => cell.$element === closest)
    if (cell) {
      this.select(cell)
    }
  }

  static ClassNames = Object.freeze({ Grid: 'grid' })

  static DefaultWidth = 5

  static Generator = class {
    grid
    id
    seed
    width

    #rand

    constructor (id, width) {
      this.id = id
      this.width = Grid.Generator.getWidth(width)
      console.log(width, this.width)
      this.seed = Grid.Generator.getSeed(this.id, this.width)
      this.#rand = Grid.Generator.splitmix32(this.seed)

      const grid = []
      const size = this.width * this.width
      for (let i = 0; i < size; i++) {
        const content = Grid.Generator.getLetter(this.#rand())
        grid.push({ content })
      }

      this.grid = grid
    }

    static getLetter (num) {
      return Grid.Generator.lettersByWeight.find(([, weight]) => weight > num)[0]
    }

    static getSeed (id, width) {
      return Grid.Generator.cyrb53([id, Grid.Generator.getWidth(width)].join(','))
    }

    static getWidth (width) {
      return Grid.Widths.includes(Number(width)) ? width : Grid.DefaultWidth
    }

    static lettersByWeight = Object.entries(lettersByWeight)

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
  }

  static Widths = Object.freeze([5, 7, 9])
}
