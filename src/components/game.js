import { Grid } from './grid'
import { Cell } from './cell'
import { Dictionary } from './dictionary'

export class Game {
  dictionary
  selected = []
  grid

  constructor () {
    // TODO: this should be randomly generated, but consistent based on a seed
    const configuration = {
      grid: [
        [{ content: "a" }, { content: "q" }, { content: "p" }, { content: "m" }],
        [{ content: "x" }, { content: "u" }, { content: "y" }, { content: "i" }],
        [{ content: "e" }, { content: "i" }, { content: "r" }, { content: "l" }],
        [{ content: "s" }, { content: "p" }, { content: "e" }, { content: "d" }]
      ]
    }

    this.dictionary = new Dictionary()
    this.grid = new Grid(this, configuration.grid)

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

  select (cells) {
    const word = cells.map((cell) => cell.content).join('')

    if (this.dictionary.isValid(word)) {
      const lastIndex = cells.length - 1
      cells.forEach((cell, index) => {
        const classNames = [Game.States.Word]

        if (index < lastIndex) {
          classNames.push(cell.getDirection(cells[index + 1]))
          if (index === 0) {
            classNames.push(Game.States.WordStart)
            if (this.selected.length === 0) {
              classNames.push(Game.States.PathStart)
            }
          }
        } else {
          classNames.push(Game.States.WordEnd)
        }

        cell.$element.classList.add(...classNames)
      })
      this.selected.push(cells)
    }

    cells.forEach((cell) => cell.$element.classList.remove(Cell.States.Pending))
  }

  static States = Object.freeze({
    PathStart: 'path-start',
    Word: 'word',
    WordStart: 'word-start',
    WordEnd: 'word-end'
  })
}
