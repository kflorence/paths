import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'
import { Coordinates } from './coordinates'

export class Cell extends Stateful {
  $element = document.createElement('div')

  content
  coordinates

  #eventListeners = new EventListeners({ context: this, element: this.$element })

  constructor (parent, state, { row, column }) {
    super(state)

    this.coordinates = new Coordinates(row, column)
    this.content = state.content
    this.parent = parent

    this.#setup()
  }

  getDirection (cell) {
    return this.getNeighbor(cell).direction
  }

  getNeighbor (cell) {
    return this.getNeighbors().find((neighbor) => cell.coordinates.equals(neighbor.coordinates))
  }

  getNeighbors () {
    return Cell.Neighbors.map((neighbor) => {
      const { direction, offset } = neighbor
      const coordinates = this.coordinates.add(offset)
      return { coordinates, direction }
    })
  }

  teardown () {
    this.#eventListeners.remove()
    this.$element.remove()
  }

  toString () {
    return `[Cell:${this.coordinates.toString()}]`
  }

  #onPointerEnter () {
    this.parent.select(this)
  }

  #setup () {
    this.$element.classList.add('cell')
    this.$element.textContent = this.content
    this.#eventListeners.add([{ handler: this.#onPointerEnter, type: 'pointerenter' }])
  }

  static Directions = Object.freeze({
    Down: 'direction-down',
    Left: 'direction-left',
    Right: 'direction-right',
    Up: 'direction-up'
  })

  static Events = Object.freeze({ Enter: 'cell-enter' })

  static Neighbors = [
    {
      direction: Cell.Directions.Down,
      offset: new Coordinates(1, 0)
    },
    {
      direction: Cell.Directions.Left,
      offset: new Coordinates(0, -1)
    },
    {
      direction: Cell.Directions.Right,
      offset: new Coordinates(0, 1)
    },
    {
      direction: Cell.Directions.Up,
      offset: new Coordinates(-1, 0)
    }
  ]

  static States = Object.freeze({ Pending: 'pending' })
}
