import { Cell } from './cell'
import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'
import { Game } from './game'

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

  cancel () {
    this.#pointerDownEvent = undefined

    if (this.isPending()) {
      this.parent.select(this.selected)
      this.selected = []
    }
  }

  getLastSelected () {
    return this.selected[this.selected.length - 1]
  }

  isPending () {
    return this.selected.length > 0
  }

  select (cell) {
    if (!this.#pointerDownEvent || cell.$element.classList.contains(Game.States.Word)) {
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

    cell.$element.classList.add(...classNames)

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

    this.#eventListeners.add([{ handler: this.#onPointerDown, type: 'pointerdown' }])
  }

  teardown () {
    this.#eventListeners.remove()

    this.cells.forEach((cell) => cell.teardown())
    this.cells = []

    this.$element.replaceChildren()
    this.$element.classList.value = ''
  }

  #onPointerDown (event) {
    this.#pointerDownEvent = event

    const cell = this.cells.find((cell) => cell.$element === event.target)
    if (cell) {
      this.select(cell)
    }
  }
}
