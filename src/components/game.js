import { Grid } from './grid'
import { Cell } from './cell'
import { Dictionary } from './dictionary'

export class Game {
  dictionary
  words = []
  grid

  #state

  constructor (state) {
    this.#state = state
    this.dictionary = new Dictionary()

    const { grid, width } = this.#state.getState()
    this.grid = new Grid(this, grid, width)

    // Listening on document to handle pointerup outside the grid area
    document.addEventListener('pointerup', () => this.grid.deselect())

    this.grid.setup()

    // TODO: need to update words based on loaded state
  }

  getLastSelected () {
    const path = this.getPath()
    return path[path.length - 1]
  }

  getPath () {
    return this.words.flat()
  }

  getWords () {
    return this.words.map(Game.getWord)
  }

  select (cells) {
    const word = Game.getWord(cells)

    if (this.dictionary.isValid(word)) {
      const lastIndex = cells.length - 1
      const wordIndex = this.words.length
      cells.forEach((cell, index) => {
        const classNames = [Cell.ClassNames.Word]
        if (index < lastIndex) {
          if (index === 0) {
            classNames.push(Cell.ClassNames.WordStart)
            if (this.words.length === 0) {
              classNames.push(Cell.ClassNames.First)
            }
          }
        } else {
          classNames.push(Cell.ClassNames.WordEnd)
        }

        cell.add(classNames)
        cell.addIndex(wordIndex)
        cell.remove(Cell.ClassNames.Selected)
      })
      this.words.push(cells)
    } else {
      cells.forEach((cell) => cell.reset())
    }
  }

  update () {
    this.#state.updateState((state) => { state.grid = this.grid.getState() })
  }

  static getWord (cells) {
    return cells.map((cell) => cell.getContent()).join('')
  }
}
