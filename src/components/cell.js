import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'

let uniqueId = 0

export class Cell extends Stateful {
  $element = document.createElement('div')

  column
  content
  id = uniqueId++
  row

  #eventListeners = new EventListeners({ context: this, element: this.$element })

  constructor (parent, state, configuration) {
    super(state)

    this.column = configuration.column
    this.content = state.content
    this.parent = parent
    this.row = configuration.row

    this.#setup()
  }

  getNeighbors () {
    return Cell.Neighbors.map((neighbor) => [this.row + neighbor[0], this.column + neighbor[1]])
  }

  isNeighbor (cell) {
    return this.getNeighbors().some((neighbor) => cell.row === neighbor[0] && cell.column === neighbor[1])
  }

  teardown () {
    this.#eventListeners.remove()
    this.$element.remove()
  }

  toString () {
    return `[Cell:${[this.row, this.column].join(',')}]`
  }

  #onPointerEnter () {
    this.parent.select(this)
  }

  #setup () {
    this.$element.classList.add('cell')
    this.$element.textContent = this.content
    this.#eventListeners.add([{ handler: this.#onPointerEnter, type: 'pointerenter' }])
  }

  static Events = Object.freeze({ Enter: 'cell-enter' })

  static Neighbors = [[0, -1], [0, 1], [-1, 0], [1, 0]]

  static States = Object.freeze({
    First: 'cell-first',
    Locked: 'cell-locked',
    Selected: 'cell-selected'
  })
}
