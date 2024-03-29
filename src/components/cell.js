import { Directions } from './coordinates'
import { getClassName } from './util'
import { Flag, Flags } from './flag'
import { EventListeners } from './eventListeners'

const $grid = document.getElementById('grid')

export class Cell {
  #$content = document.createElement('span')
  #$element = document.createElement('div')

  #coordinates
  #eventListeners = new EventListeners({ context: this, element: this.#$element })
  #state

  constructor (coordinates, state) {
    this.#coordinates = coordinates
    this.#state = state

    this.#eventListeners.add([
      { type: 'pointerdown', handler: this.#onSelect },
      { type: 'pointerenter', handler: this.#onSelect }
    ])

    this.update()
  }

  equals (other) {
    return this.getIndex() === other.getIndex()
  }

  getContent () {
    return this.#state.content
  }

  getCoordinates () {
    return this.#coordinates
  }

  getElement () {
    return this.#$element
  }

  getIndex () {
    return this.#state.index
  }

  isNeighbor (other) {
    return this.getCoordinates().isNeighbor(other.getCoordinates())
  }

  toString () {
    return `[${Cell.Name}:${this.getCoordinates.toString()}]`
  }

  update (f) {
    if (typeof f === 'function') {
      const state = f(this.#state)
      console.log('state update', state)
      if (!(state instanceof Cell.State)) {
        throw new Error('Return value from update function must be of type Cell.State!')
      }
      this.#state = state
    }

    this.#$element.className = Cell.Name

    const flags = Object.values(Cell.Flags).filter((flag) => this.#state.getFlags().has(flag))
    flags.forEach((flag) => this.#$element.classList.add(getClassName(Cell.Name, flag.name)))

    this.#$content.textContent = this.#state.content
    this.#$element.replaceChildren(this.#$content)

    return this.#state
  }

  #onSelect (event) {
    // Requirements for cell selection:
    // - user is clicking or touching the cell
    // - the cell is not already selected
    if (event.buttons > 0 && !this.#state.getFlags().has(Cell.Flags.Selected)) {
      const detail = { cell: this }
      $grid.dispatchEvent(new CustomEvent(Cell.Events.Select, { detail }))
    }
  }

  static Events = Object.freeze({ Select: 'cell-select' })

  static Flags = Object.freeze({
    DirectionEast: new Flag(Directions.East, 0),
    DirectionNorth: new Flag(Directions.North, 1),
    DirectionNorthEast: new Flag(Directions.NorthEast, 2),
    DirectionNorthWest: new Flag(Directions.NorthWest, 3),
    DirectionSouth: new Flag(Directions.South, 4),
    DirectionSouthEast: new Flag(Directions.SouthEast, 5),
    DirectionSouthWest: new Flag(Directions.SouthWest, 6),
    DirectionWest: new Flag(Directions.West, 7),
    First: new Flag('first', 8),
    Last: new Flag('last', 9),
    Selected: new Flag('selected', 10),
    Swapped: new Flag('swapped', 11),
    Validated: new Flag('validated', 12),
    WordEnd: new Flag('word-end', 13),
    WordStart: new Flag('word-start', 14)
  })

  static FlagsByName = Object.fromEntries(Object.values(Cell.Flags).map((flag) => [flag.name, flag]))

  static Name = 'cell'

  static State = class {
    index
    content
    flags

    #flags

    constructor (index, content, flags = 0) {
      this.index = index
      this.content = content
      this.flags = (flags instanceof Flags) ? flags.get() : flags
    }

    copy (settings) {
      return new Cell.State(
        settings.index ?? this.index,
        settings.content ?? this.content,
        settings.flags ?? this.flags
      )
    }

    getFlags () {
      return this.#flags ?? (this.#flags = new Flags(this.flags))
    }
  }
}
