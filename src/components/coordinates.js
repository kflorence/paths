export class Coordinates {
  id

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

  toString () {
    return this.id
  }

  static fromString (coordinates) {
    return new Coordinates(...coordinates.split(','))
  }
}
