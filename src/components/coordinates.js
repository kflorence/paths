export class Coordinates {
  constructor (row, column) {
    this.row = row
    this.column = column
  }

  add (other) {
    return new Coordinates(this.row + other.row, this.column + other.column)
  }

  equals (other) {
    return this.row === other.row && this.column === other.column
  }

  toString () {
    return [this.row, this.column].join(',')
  }
}
