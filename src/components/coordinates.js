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
  index

  #neighbors
  #width

  constructor (row, column, width) {
    this.id = [row, column].join(',')
    this.row = Number(row)
    this.column = Number(column)

    if (width !== undefined) {
      this.#width = width
      this.index = (this.row * width) + this.column
    }
  }

  add (other) {
    return new Coordinates(this.row + other.row, this.column + other.column, this.#width)
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

  static getNeighbors (coordinates) {
    return Coordinates.Neighbors
      .map((neighbor) => new Coordinates.Neighbor(neighbor.direction, coordinates.add(neighbor.coordinates)))
  }

  static isCrossing (direction, occupiedDirections) {
    return Coordinates.Crossings[direction]?.every((direction) => occupiedDirections.includes(direction))
  }

  static Crossings = Object.freeze({
    [Directions.NorthEast]: [Directions.North, Directions.East],
    [Directions.NorthWest]: [Directions.North, Directions.West],
    [Directions.SouthEast]: [Directions.South, Directions.East],
    [Directions.SouthWest]: [Directions.South, Directions.West]
  })

  static Neighbor = class {
    coordinates
    direction
    index

    constructor (direction, coordinates) {
      this.direction = direction
      this.coordinates = coordinates
      this.index = coordinates.index
    }
  }

  static Neighbors = Object.freeze([
    new Coordinates.Neighbor(Directions.East, new Coordinates(0, 1)),
    new Coordinates.Neighbor(Directions.North, new Coordinates(-1, 0)),
    new Coordinates.Neighbor(Directions.NorthEast, new Coordinates(-1, 1)),
    new Coordinates.Neighbor(Directions.NorthWest, new Coordinates(-1, -1)),
    new Coordinates.Neighbor(Directions.South, new Coordinates(1, 0)),
    new Coordinates.Neighbor(Directions.SouthEast, new Coordinates(1, 1)),
    new Coordinates.Neighbor(Directions.SouthWest, new Coordinates(1, -1)),
    new Coordinates.Neighbor(Directions.West, new Coordinates(0, -1))
  ])
}
