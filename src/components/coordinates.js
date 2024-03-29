import { getClassName } from './util'

const direction = 'direction'
const east = 'east'
const north = 'north'
const south = 'south'
const west = 'west'

export const Directions = Object.freeze({
  East: getClassName(direction, east),
  North: getClassName(direction, north),
  NorthEast: getClassName(direction, north, east),
  NorthWest: getClassName(direction, north, west),
  South: getClassName(direction, south),
  SouthEast: getClassName(direction, south, east),
  SouthWest: getClassName(direction, south, west),
  West: getClassName(direction, west)
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
    new Coordinates.Neighbor(Directions.South, new Coordinates(1, 0)),
    new Coordinates.Neighbor(Directions.West, new Coordinates(0, -1)),
    new Coordinates.Neighbor(Directions.East, new Coordinates(0, 1)),
    new Coordinates.Neighbor(Directions.North, new Coordinates(-1, 0))
  ])
}
