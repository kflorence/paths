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
    // Requires click/drag or touch
    // Cannot select a cell that's already part of a word
    if (event.buttons > 0 && !this.#state.getFlags().has(Cell.Flags.Word)) {
      const detail = { cell: this }
      $grid.dispatchEvent(new CustomEvent(Cell.Events.Select, { detail }))
    }
  }

  static directionToFlag (direction) {
    switch (direction) {
      case Directions.Down: {
        return Cell.Flags.PathDown
      }
      case Directions.Left: {
        return Cell.Flags.PathLeft
      }
      case Directions.Right: {
        return Cell.Flags.PathRight
      }
      case Directions.Up: {
        return Cell.Flags.PathUp
      }
    }
  }

  static Events = Object.freeze({ Select: 'cell-select' })

  static Flags = Object.freeze({
    First: new Flag('first', 0),
    Last: new Flag('last', 1),
    Path: new Flag('path', 2),
    PathDown: new Flag('path-down', 3),
    PathLeft: new Flag('path-left', 4),
    PathRight: new Flag('path-right', 5),
    PathUp: new Flag('path-up', 6),
    Selected: new Flag('selected', 7),
    Swapped: new Flag('swapped', 8),
    Validated: new Flag('validated', 9),
    Word: new Flag('word', 10),
    WordEnd: new Flag('word-end', 11),
    WordStart: new Flag('word-start', 12)
  })

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
