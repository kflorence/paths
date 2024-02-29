import { Grid } from './grid'
import { Cell } from './cell'
import { Dictionary } from './dictionary'

export class Game {
  dictionary
  grid
  path = []

  constructor () {
    // TODO: this should be randomly generated, but consistent based on a seed
    const configuration = {
      language: Dictionary.Languages.English,
      grid: [
        [{ content: "a" }, { content: "q" }, { content: "p" }, { content: "m" }],
        [{ content: "x" }, { content: "u" }, { content: "y" }, { content: "i" }],
        [{ content: "e" }, { content: "i" }, { content: "r" }, { content: "l" }],
        [{ content: "s" }, { content: "p" }, { content: "e" }, { content: "d" }]
      ]
    }

    this.dictionary = new Dictionary(configuration.language)
    this.grid = new Grid(this, configuration.grid)
  }

  check (cells) {
    const word = cells.map((cell) => cell.content).join('')
    console.log(word, this.dictionary.isValid(word))
  }
}
