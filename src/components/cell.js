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

    this.#$content.className = 'content'

    const $background = document.createElement('div')
    $background.classList.add('background')
    $background.append(this.#$content)

    this.#$element.append($background)

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

  getFlags () {
    return this.#state.getFlags()
  }

  getIndex () {
    return this.#state.index
  }

  isNeighbor (other) {
    return this.getCoordinates().isNeighbor(other.getCoordinates())
  }

  reset () {
    this.update((state) => {
      const flags = new Flags()
      const existing = state.getFlags()
      Cell.StickyFlags.filter((flag) => existing.has(flag)).forEach((flag) => flags.add(flag))
      return state.copy({ flags })
    })
  }

  toString () {
    return `[${Cell.Name}:${this.getCoordinates.toString()}]`
  }

  update (state) {
    if (state !== undefined) {
      if (typeof state === 'function') {
        state = state(this.#state)
      }
      if (!(state instanceof Cell.State)) {
        throw new Error('Cannot update cell state: value given is not of type Cell.State')
      }
      this.#state = state
    }

    this.#$element.className = Cell.Name
    this.#$element.dataset.index = this.getIndex()

    const flags = this.getFlags()
    const activeFlags = Object.values(Cell.Flags).filter((flag) => flags.has(flag))
    activeFlags.forEach((flag) => this.#$element.classList.add(getClassName(Cell.Name, flag.name)))

    this.#$content.textContent = this.#state.content

    return this.#state
  }

  #onSelect (event) {
    if (event.type === 'pointerdown') {
      event.target.releasePointerCapture(event.pointerId)
    }

    if (event.buttons > 0) {
      // User has clicked or touched the cell
      const detail = { cell: this }
      $grid.dispatchEvent(new CustomEvent(Cell.Events.Select, { detail }))
    }
  }

  static Events = Object.freeze({ Select: 'cell-select' })

  static Flags = Object.freeze({
    Active: new Flag('active'),
    DirectionEast: new Flag(Directions.East),
    DirectionNorth: new Flag(Directions.North),
    DirectionNorthEast: new Flag(Directions.NorthEast),
    DirectionNorthWest: new Flag(Directions.NorthWest),
    DirectionSouth: new Flag(Directions.South),
    DirectionSouthEast: new Flag(Directions.SouthEast),
    DirectionSouthWest: new Flag(Directions.SouthWest),
    DirectionWest: new Flag(Directions.West),
    First: new Flag('first'),
    Last: new Flag('last'),
    Path: new Flag('path'),
    Selected: new Flag('selected'),
    Swap: new Flag('swap'),
    Swapped: new Flag('swapped'),
    Validated: new Flag('validated'),
    WordEnd: new Flag('word-end'),
    WordStart: new Flag('word-start')
  })

  static FlagsByName = Object.fromEntries(Object.values(Cell.Flags).map((flag) => [flag.name, flag]))

  static StickyFlags = Object.freeze([Cell.Flags.Swapped])

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
