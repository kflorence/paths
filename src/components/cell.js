import { Stateful } from './stateful'
import { EventListeners } from './eventListeners'
import { Coordinates } from './coordinates'

let uniqueId = 0

export class Cell extends Stateful {
  $content = document.createElement('span')
  $element = document.createElement('div')

  coordinates
  id

  #eventListeners = new EventListeners({ context: this, element: this.$element })

  constructor (parent, state, { row, column }) {
    state.id ??= uniqueId++
    state.index ??= []

    super(state)

    this.coordinates = new Coordinates(row, column)
    this.id = state.id
    this.parent = parent

    this.#setup()
  }

  addClassNames (...classNames) {
    classNames.forEach((className) => {
      if (!Cell.#ClassNames.includes(className)) {
        throw new Error(`Invalid className for cell: ${className}`)
      }
    })
    this.$element.classList.add(...classNames)
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

  getIndex () {
    return this.getState().index
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

  hasClassName (className) {
    return this.$element.classList.contains(className)
  }

  removeClassNames (...classNames) {
    this.$element.classList.remove(...classNames)
  }

  reset () {
    const state = this.getOriginalState()
    this.#reset(state)
    this.updateState(() => state)
  }

  select (last) {
    const classNames = [Cell.ClassNames.Selected]
    if (last) {
      classNames.push(this.getDirection(last))
    }
    this.addClassNames(...classNames)
  }

  setContent (content) {
    this.$content.textContent = content
    this.updateState((state) => { state.content = content })
  }

  setIndex (...index) {
    this.$element.dataset.index = index.join(',')
    this.updateState((state) => { state.index = index })
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

  #reset (state) {
    this.$content.textContent = state.content
    this.$element.replaceChildren(this.$content)
    this.$element.className = Cell.ClassNames.Cell
    if (state.index.length > 0) {
      this.$element.dataset.index = state.index.join(',')
    }
  }

  #setup () {
    this.#reset(this.getState())
    this.#eventListeners.add([{ handler: this.#onPointerEnter, type: 'pointerenter' }])
  }

  static ClassNames = Object.freeze({
    Cell: 'cell',
    DirectionDown: 'cell-direction-down',
    DirectionLeft: 'cell-direction-left',
    DirectionRight: 'cell-direction-right',
    DirectionUp: 'cell-direction-up',
    First: 'cell-first',
    Last: 'cell-last',
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
