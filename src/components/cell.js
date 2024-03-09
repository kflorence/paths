import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'
import { Coordinates } from './coordinates'

let uniqueId = 0

export class Cell extends Stateful {
  $element = document.createElement('div')

  coordinates
  id

  #eventListeners = new EventListeners({ context: this, element: this.$element })

  constructor (parent, state, { row, column }) {
    state.classNames ??= [Cell.ClassNames.Cell]
    state.id ??= uniqueId++

    super(state)

    this.coordinates = new Coordinates(row, column)
    this.id = state.id
    this.parent = parent

    this.#setup()
  }

  add (classNames) {
    classNames = Array.isArray(classNames) ? classNames : [classNames]
    classNames.forEach((className) => {
      if (!Cell.#ClassNames.includes(className)) {
        throw new Error(`Invalid className for cell: ${className}`)
      }
    })
    this.$element.classList.add(...classNames)
    this.update()
  }

  addIndex (index) {
    this.$element.dataset.index = index
  }

  equals (other) {
    return this.id === other.id
  }

  getContent () {
    return this.getState().content
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
    const state = this.getState()
    this.$element.classList.add(...state.classNames)
    this.$element.textContent = state.content
    this.#eventListeners.add([{ handler: this.#onPointerEnter, type: 'pointerenter' }])
  }

  static ClassNames = Object.freeze({
    Cell: 'cell',
    DirectionDown: 'cell-direction-down',
    DirectionLeft: 'cell-direction-left',
    DirectionRight: 'cell-direction-right',
    DirectionUp: 'cell-direction-up',
    First: 'cell-first',
    Selected: 'cell-selected',
    Word: 'cell-word',
    WordEnd: 'cell-word-end',
    WordStart: 'cell-word-start'
  })

  static #ClassNames = Object.values(Cell.ClassNames)

  static Directions = Object.freeze({
    Down: Cell.ClassNames.DirectionDown,
    Left: Cell.ClassNames.DirectionLeft,
    Right: Cell.ClassNames.DirectionRight,
    Up: Cell.ClassNames.DirectionUp
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
}
