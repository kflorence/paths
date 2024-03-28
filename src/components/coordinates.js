export const Directions = Object.freeze({
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Up: 'up'
})

export class Coordinates {
  id

  #neighbors

  constructor (row, column) {
    this.id = [row, column].join(',')
    this.row = Number(row)
    this.column = Number(column)
  }

  add (other) {
    return new Coordinates(this.row + other.row, this.column + other.column)
  }

  equals (other) {
    return this.id === other.id
  }

  getDirection (other) {
    return this.getNeighbors().find((neighbor) => neighbor.coordinates.equals(other))?.direction
  }

  getNeighbors () {
    return this.#neighbors ?? (this.#neighbors = Coordinates.getNeighbors(this))
  }

  isNeighbor (other) {
    return this.getNeighbors().some((neighbor) => neighbor.coordinates.equals(other))
  }

  toString () {
    return this.id
  }

  static fromString (coordinates) {
    return new Coordinates(...coordinates.split(','))
  }

  static getNeighbors (coordinates) {
    return Coordinates.Neighbors
      .map((neighbor) => new Coordinates.Neighbor(neighbor.direction, coordinates.add(neighbor.coordinates)))
  }

  static Neighbor = class {
    constructor (direction, coordinates) {
      this.direction = direction
      this.coordinates = coordinates
    }
  }

  static Neighbors = Object.freeze([
    new Coordinates.Neighbor(Directions.Down, new Coordinates(1, 0)),
    new Coordinates.Neighbor(Directions.Left, new Coordinates(0, -1)),
    new Coordinates.Neighbor(Directions.Right, new Coordinates(0, 1)),
    new Coordinates.Neighbor(Directions.Up, new Coordinates(-1, 0))
  ])
}
