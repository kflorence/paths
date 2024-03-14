import { EventListeners } from './eventListeners'
import { Coordinates } from './coordinates'

export class Cell {
  $content = document.createElement('span')
  $element = document.createElement('div')

  #content
  #coordinates
  #eventListeners = new EventListeners({ context: this, element: this.$element })
  #parent

  constructor (parent, configuration) {
    this.#content = configuration.content
    this.#coordinates = Coordinates.fromString(configuration.id)
    this.#parent = parent
    this.#eventListeners.add([{ handler: this.#onPointerEnter, type: 'pointerenter' }])

    this.addClassNames(Cell.ClassNames.Cell)
    this.setContent(configuration.content)
    this.setSelected(configuration.selected)
  }

  addClassNames (...classNames) {
    classNames.forEach((className) => {
      if (!Cell.#ClassNames.includes(className)) {
        throw new Error(`Invalid className for cell: ${className}`)
      }
    })
    this.$element.classList.add(...classNames)
  }

  deselect () {
    this.setSelected(undefined)
    this.removeClassNamesExcept(Cell.ClassNames.Cell, Cell.ClassNames.Swapped)
  }

  equals (other) {
    return this.#coordinates.equals(other.getCoordinates())
  }

  getContent () {
    return this.$content.textContent
  }

  getCoordinates () {
    return this.#coordinates
  }

  getDirection (other) {
    return this.getNeighbors().find((neighbor) => other.getCoordinates().equals(neighbor.coordinates))?.direction
  }

  getSelected () {
    return this.$element.dataset.selected
  }

  getNeighbors () {
    return Cell.Neighbors.map((neighbor) => {
      const { direction, offset } = neighbor
      const coordinates = this.#coordinates.add(offset)
      return { coordinates, direction }
    })
  }

  getState () {
    return new Cell.State(this.#coordinates.toString(), this.getContent(), this.getSelected())
  }

  hasClassName (className) {
    return this.$element.classList.contains(className)
  }

  isNeighbor (cell) {
    return this.getDirection(cell) !== undefined
  }

  removeClassNames (...classNames) {
    classNames.length
      ? this.$element.classList.remove(...classNames)
      : this.$element.className = Cell.ClassNames.Cell
  }

  removeClassNamesExcept (...classNames) {
    this.removeClassNames(...Cell.#ClassNames.filter((className) => !classNames.includes(className)))
  }

  reset () {
    this.setContent(this.#content)
    this.setSelected(undefined)
    this.removeClassNames()
  }

  select (link) {
    const classNames = [Cell.ClassNames.Selected]
    if (link) {
      classNames.push(this.getDirection(link))
    }
    this.addClassNames(...classNames)
  }

  setContent (content) {
    this.$content.textContent = content
    this.$element.replaceChildren(this.$content)
  }

  setSelected (selected) {
    if (selected === undefined) {
      delete this.$element.dataset.selected
    } else {
      this.$element.dataset.selected = selected
    }
  }

  toString () {
    return `[Cell:${this.#coordinates.toString()}]`
  }

  #onPointerEnter () {
    this.#parent.select(this)
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
    Swapped: 'cell-swapped',
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

  static State = class {
    id
    content
    selected

    constructor (id, content, selected) {
      this.id = id
      this.content = content
      this.selected = selected
    }
  }
}
