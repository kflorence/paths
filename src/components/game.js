import { Grid } from './grid'
import { Cell } from './cell'
import { Dictionary } from './dictionary'

export class Game {
  dictionary
  grid
  words = []

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
  }

  getLastCell () {
    const cells = this.words[this.words.length - 1]
    if (cells) {
      return cells[cells.length - 1]
    }
  }

  check (cells) {
    const word = cells.map((cell) => cell.content).join('')
    if (this.dictionary.isValid(word)) {
      cells.forEach((cell) => cell.$element.classList.add(Cell.States.Locked))
      this.words.push(cells)
    }
    cells.forEach((cell) => cell.$element.classList.remove(Cell.States.Selected))
  }
}
