import { Cell } from './cell'
import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'
import { Game } from './game'
import { lettersByWeight } from './letters'

export class Grid extends Stateful {
  $element = document.getElementById('grid')

  cells = []
  selected = []
  width

  #eventListeners = new EventListeners({ context: this, element: this.$element })
  #pointerDownEvent

  constructor (parent, state) {
    const width = state[0].length

    super(state.flat())

    this.parent = parent
    this.width = width

    this.setup()
  }

  cancel () {
    this.#pointerDownEvent = undefined

    if (this.isPending()) {
      this.parent.select(this.selected)
      this.selected = []
    }

    this.update()
  }

  getLastSelected () {
    return this.selected[this.selected.length - 1]
  }

  isPending () {
    return this.selected.length > 0
  }

  select (cell) {
    if (!this.#pointerDownEvent || cell.has(Game.States.Word)) {
      return
    }

    const index = this.selected.findIndex((selected) => selected.equals(cell))
    if (index > -1) {
      // Going back to an already selected cell, remove everything selected after it
      const removed = this.selected.splice(index + 1)
      removed.forEach((c) => c.reset())
      return
    }

    const lastSelected = this.getLastSelected()
    const last = lastSelected ?? this.parent.getLastSelected()
    if (last && !last.getNeighbor(cell)) {
      return
    }

    const classNames = [Cell.States.Pending]

    if (lastSelected) {
      classNames.push(cell.getDirection(lastSelected))
    }

    cell.add(classNames)

    this.selected.push(cell)
  }

  setup () {
    this.teardown()

    this.$element.classList.add('grid', `grid-${this.width}`)

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

  teardown () {
    this.#eventListeners.remove()

    this.cells.forEach((cell) => cell.teardown())
    this.cells = []

    this.$element.replaceChildren()
    this.$element.classList.value = ''
  }

  update () {
    this.updateState(() => this.cells.map((cell) => cell.getState()))
  }

  #onPointerDown (event) {
    this.#pointerDownEvent = event

    const cell = this.cells.find((cell) => cell.$element === event.target)
    if (cell) {
      this.select(cell)
    }
  }

  static Generator = class {
    grid
    id
    size

    #seed
    #rand

    constructor (id, size) {
      size ??= Grid.Sizes['5x5']

      const entropy = [id, size].join(',')

      this.id = id
      this.size = size

      this.#seed = Grid.Generator.cyrb53(entropy)
      this.#rand = Grid.Generator.splitmix32(this.#seed)

      const grid = []
      for (let r = 0; r < size; r++) {
        const row = []
        for (let c = 0; c < size; c++) {
          const content = Grid.Generator.getLetter(this.#rand())
          row.push({ content })
        }
        grid.push(row)
      }

      this.grid = grid
    }

    static getLetter (num) {
      return Grid.Generator.lettersByWeight.find(([, weight]) => weight > num)[0]
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

  static Sizes = Object.freeze({
    '5x5': 5,
    '7x7': 7,
    '9x9': 9
  })
}
