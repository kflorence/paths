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

const DiagonalDirections = Object.freeze([
  Directions.NorthEast,
  Directions.NorthWest,
  Directions.SouthEast,
  Directions.SouthWest
])

export class Coordinates {
  column
  id
  row

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
    return this.id === other?.id
  }

  getDirection (other) {
    return this.getNeighbors().find((neighbor) => neighbor.coordinates.equals(other))?.direction
  }

  getNeighbors () {
    if (!this.#neighbors) {
      this.#neighbors = Coordinates.getNeighbors(this)
    }
    return this.#neighbors
  }

  getNeighborsCrossing (other) {
    const crossing = Coordinates.Crossings[this.getDirection(other)] ?? []
    return this.getNeighbors().filter((neighbor) => crossing.includes(neighbor.direction))
  }

  isNeighbor (other) {
    return this.getNeighbors().some((neighbor) => neighbor.coordinates.equals(other))
  }

  toString () {
    return this.id
  }

  static getNeighbors (coordinates) {
    return Coordinates.Neighbors
      .map((neighbor) => new Coordinates.Neighbor(coordinates.add(neighbor.coordinates), neighbor.direction))
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
    isDirectionDiagonal

    constructor (coordinates, direction) {
      this.coordinates = coordinates
      this.direction = direction
      this.isDirectionDiagonal = DiagonalDirections.includes(direction)
    }
  }

  static Neighbors = Object.freeze([
    new Coordinates.Neighbor(new Coordinates(0, 1), Directions.East),
    new Coordinates.Neighbor(new Coordinates(-1, 0), Directions.North),
    new Coordinates.Neighbor(new Coordinates(-1, 1), Directions.NorthEast),
    new Coordinates.Neighbor(new Coordinates(-1, -1), Directions.NorthWest),
    new Coordinates.Neighbor(new Coordinates(1, 0), Directions.South),
    new Coordinates.Neighbor(new Coordinates(1, 1), Directions.SouthEast),
    new Coordinates.Neighbor(new Coordinates(1, -1), Directions.SouthWest),
    new Coordinates.Neighbor(new Coordinates(0, -1), Directions.West)
  ])
}
