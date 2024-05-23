import { Grid } from '../grid'
import { Cell } from '../cell'

/**
 * Picks a random character from the characters array for each cell in the grid.
 */
export class Scramble extends Grid.Generator {
  characters
  configuration
  dictionary
  rand
  words

  #cells = []

  generate () {
    super.generate()

    const characters = Array.from(this.characters)
    for (let index = 0; index < this.configuration.size; index++) {
      const coordinates = this.getCoordinates(index)
      const characterIndex = Math.floor(this.rand() * characters.length)
      const [character] = characters.splice(characterIndex, 1)
      const configuration = new Cell.State(index, character)
      const cell = new Cell(coordinates, configuration)

      this.#cells.push(cell)
    }

    return new Grid.State.Configuration(this.#cells, this.words)
  }
}
