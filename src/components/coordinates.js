export class Coordinates {
  id
  neighbors

  constructor (row, column) {
    this.id = [row, column].join(',')
    this.row = Number(row)
    this.column = Number(column)
    this.neighbors = Coordinates.getNeighbors(this)
  }

  add (other) {
    return new Coordinates(this.row + other.row, this.column + other.column)
  }

  equals (other) {
    return this.id === other.id
  }

  getDirection (other) {
    return this.neighbors.find((neighbor) => neighbor.equals(other))?.direction
  }

  isNeighbor (other) {
    return this.neighbors.some((neighbor) => neighbor.equals(other))
  }

  toString () {
    return this.id
  }

  static fromString (coordinates) {
    return new Coordinates(...coordinates.split(','))
  }

  static getNeighbors (coordinates) {
    return Coordinates.Offsets
      .map((offset) => ({ coordinates: coordinates.add(offset.coordinates), direction: offset.direction }))
  }

  static Offsets = Object.freeze([
    { coordinates: new Coordinates(1, 0), direction: Directions.Down },
    { coordinates: new Coordinates(0, -1), direction: Directions.Left },
    { coordinates: new Coordinates(0, 1), direction: Directions.Right },
    { coordinates: new Coordinates(-1, 0), direction: Directions.Up }
  ])
}

export const Directions = Object.freeze({
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Up: 'up'
})
