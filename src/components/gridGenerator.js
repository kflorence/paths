import { Coordinates } from './coordinates'

export class GridGenerator {
  rand
  size
  width
  words

  constructor (words, width, rand) {
    this.rand = rand
    this.size = width * width
    this.width = width
    this.words = words
  }

  generate () {}

  getCoordinates (index) {
    return new Coordinates(this.getRow(index), this.getColumn(index), this.width)
  }

  getColumn (index) {
    return index % this.width
  }

  getIndex (coordinates) {
    return (coordinates.row * this.width) + coordinates.column
  }

  getRow (index) {
    return Math.floor(index / this.width)
  }
}
