import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'
import { Coordinates } from './coordinates'

let uniqueId = 0

export class Cell extends Stateful {
  $element = document.createElement('div')

  content
  coordinates
  id = uniqueId++

  #eventListeners = new EventListeners({ context: this, element: this.$element })

  constructor (parent, state, { row, column }) {
    state.classNames ??= ['cell']

    super(state)

    this.coordinates = new Coordinates(row, column)
    this.content = state.content
    this.parent = parent

    this.#setup()
  }

  add (classNames) {
    this.$element.classList.add(...Array.isArray(classNames) ? classNames : [classNames])
    this.update()
  }

  equals (other) {
    return this.id === other.id
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

  has (className) {
    return this.$element.classList.contains(className)
  }

  remove (classNames) {
    this.$element.classList.remove(...Array.isArray(classNames) ? classNames : [classNames])
    this.update()
  }

  reset () {
    const original = this.getOriginalState()
    this.$element.className = original.classNames.join(' ')
    this.$element.textContent = original.content
    this.updateState(() => original)
  }

  teardown () {
    this.#eventListeners.remove()
    this.$element.remove()
  }

  toString () {
    return `[Cell:${this.coordinates.toString()}]`
  }

  update (content) {
    this.$element.textContent = (content ??= this.$element.textContent)
    const classNames = Array.from(this.$element.classList.values())
    this.updateState(() => ({ content, classNames }))
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
