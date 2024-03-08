import { Grid } from './grid'
import { Cell } from './cell'
import { Dictionary } from './dictionary'

export class Game {
  dictionary
  selected = []
  grid

  constructor (state) {
    this.dictionary = new Dictionary()
    this.grid = new Grid(this, state.grid)

    // Listening on document to handle pointerup outside the grid area
    document.addEventListener('pointerup', () => this.grid.cancel())
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
      const lastIndex = cells.length - 1
      cells.forEach((cell, index) => {
        const classNames = [Game.States.Word]
        if (index < lastIndex) {
          if (index === 0) {
            classNames.push(Game.States.WordStart)
            if (this.selected.length === 0) {
              classNames.push(Game.States.PathStart)
            }
          }
        } else {
          classNames.push(Game.States.WordEnd)
        }

        cell.add(classNames)
        cell.remove(Cell.States.Pending)
      })
      this.selected.push(cells)
    } else {
      cells.forEach((cell) => cell.reset())
    }
  }

  static getWord (cells) {
    return cells.map((cell) => cell.content).join('')
  }

  static States = Object.freeze({
    PathStart: 'path-start',
    Word: 'word',
    WordStart: 'word-start',
    WordEnd: 'word-end'
  })
}
