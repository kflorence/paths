import { Cell } from './cell'
import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'

export class Grid extends Stateful {
  $element = document.getElementById('grid')

  cells = []
  selected = []
  width

  #eventListeners = new EventListeners({ context: this, element: this.$element })
  #pointerDownEvent

  constructor (parent, state) {
    super(state)

    this.parent = parent
    this.width = state[0].length

    if (!state.every((row) => row.length === this.width)) {
      throw new Error(`Grid configuration is invalid. Every row must have ${this.width} members.`)
    }

    this.setup()
  }

  select (cell) {
    if (!this.#pointerDownEvent) {
      return
    }

    const last = this.selected[this.selected.length - 1]
    if (last && !last.isNeighbor(cell)) {
      return
    }

    cell.$element.classList.add(Cell.States.Selected)
    this.selected.push(cell)
  }

  setup () {
    this.teardown()

    this.$element.classList.add('grid', `grid-${this.width}`)
    this.getState().flat().forEach((state, index) => {
      const row = Math.floor(index / this.width)
      const column = index % this.width
      const cell = new Cell(this, state, { row, column })
      this.$element.append(cell.$element)
      this.cells.push(cell)
    })

    this.#eventListeners.add([
      { handler: this.#onPointerDown, type: 'pointerdown' },
      { handler: this.#onPointerUp, type: 'pointerup' }
    ])
  }

  teardown () {
    this.#eventListeners.remove()

    this.cells.forEach((cell) => cell.teardown())
    this.cells = []

    this.$element.replaceChildren()
    this.$element.classList.value = ''
  }

  #onPointerDown (event) {
    const cell = this.cells.find((cell) => cell.$element === event.target)
    const lastCell = this.parent.getLastCell()
    if (!cell || (lastCell && !lastCell.isNeighbor(cell))) {
      return
    }

    this.#pointerDownEvent = event
    this.select(cell)
  }

  #onPointerUp () {
    this.#pointerDownEvent = undefined
    this.parent.check(this.selected)
    this.selected = []
  }
}
