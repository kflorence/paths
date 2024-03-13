import { Grid } from './grid'
import { Cell } from './cell'
import { Dictionary } from './dictionary'

const $title = document.getElementById('title')
const $words = document.getElementById('words')

export class Game {
  dictionary
  grid
  selected = []

  #pointer
  #state

  constructor (state) {
    this.#state = state
    this.dictionary = new Dictionary()

    const { id, grid, width } = this.#state.getState()
    this.grid = new Grid(this, grid, width)

    $title.href = `?id=${id}`
    $title.textContent = `#${id}`

    // Listening on document to handle pointerup outside the grid area
    document.addEventListener('pointerup', () => this.grid.deselect())

    this.grid.setup()

    // Build the words list based on data stored in cell state
    this.grid.cells.filter((cell) => cell.getIndex().length > 0).forEach((cell) => {
      const [rowIndex, columnIndex] = cell.getIndex()
      return ((this.selected[rowIndex] ??= [])[columnIndex] = cell)
    })

    this.update()
  }

  getLastSelected () {
    const path = this.getPath()
    return path[path.length - 1]
  }

  getPath () {
    return this.selected.flat()
  }

  getWords () {
    return this.selected.map(Game.getWord)
  }

  select (cells) {
    const word = Game.getWord(cells)

    if (this.dictionary.isValid(word)) {
      this.selected.push(cells)
    } else {
      cells.forEach((cell) => cell.reset())
    }

    this.update()
  }

  update () {
    const pointer = this.getLastSelected()
    if (!this.#pointer?.equals(pointer)) {
      // Update the state of the cells in the DOM based on the words multidimensional array
      const lastRowIndex = this.selected.length - 1
      this.selected.forEach((cells, rowIndex) => {
        const lastColumnIndex = cells.length - 1
        cells.forEach((cell, columnIndex) => {
          const nextCell = cells[columnIndex + 1] ?? this.selected[rowIndex + 1]?.[0]
          const classNames = [Cell.ClassNames.Word]
          if (columnIndex < lastColumnIndex) {
            if (columnIndex === 0) {
              classNames.push(Cell.ClassNames.WordStart)
              if (rowIndex === 0) {
                classNames.push(Cell.ClassNames.First)
              }
            }
          } else {
            classNames.push(Cell.ClassNames.WordEnd)
            if (rowIndex === lastRowIndex) {
              classNames.push(Cell.ClassNames.Last)
            }
          }

          cell.reset()
          cell.addClassNames(...classNames)
          cell.setIndex(rowIndex, columnIndex)
          cell.select(nextCell)
        })
      })

      this.#pointer = pointer
    }

    this.#updateScore()

    this.#state.updateState((state) => { state.grid = this.grid.getState() })
  }

  #updateScore () {
    const words = this.getWords()
    $words.replaceChildren(...words.map((word) => {
      const $element = document.createElement('li')
      $element.textContent = word
      return $element
    }))
  }

  static getWord (cells) {
    return cells.map((cell) => cell.getContent()).join('')
  }
}
