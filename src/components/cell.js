import { Directions } from './coordinates'
import { getClassName } from './util'
import { Flag, Flags } from './flag'

export class Cell {
  #$content = document.createElement('span')
  #$element = document.createElement('div')

  #coordinates
  #state

  constructor (coordinates, state) {
    this.#coordinates = coordinates
    this.setState(state)
  }

  equals (other) {
    return this.getCoordinates().equals(other.getCoordinates())
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
    return this.#state.flags
  }

  getIndex () {
    return this.#state.index
  }

  getState () {
    return structuredClone(this.#state)
  }

  setState (state) {
    if (!(state instanceof Cell.State)) {
      throw new Error('State must be instance of Cell.State')
    }

    this.#state = state
    this.update()
  }

  toString () {
    return `[${Cell.Name}:${this.getCoordinates.toString()}]`
  }

  update () {
    this.#$element.className = Cell.Name

    const flags = Object.values(Cell.Flags).filter((flag) => this.#state.flags.has(flag.value))
    flags.forEach((flag) => this.#$element.classList.add(getClassName(Cell.Name, flag.name)))

    this.#$content.textContent = this.#state.content
    this.#$element.replaceChildren(this.#$content)
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

    constructor (index, content, flags) {
      this.index = index
      this.content = content
      this.flags = flags ?? new Flags()
    }

    copy (settings) {
      return new Cell.State(
        settings.index ?? this.index,
        settings.content ?? this.content,
        settings.flags ?? this.flags
      )
    }
  }
}
