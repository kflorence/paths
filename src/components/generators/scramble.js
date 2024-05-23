import { Grid } from '../grid'
import { Cell } from '../cell'
import { Generator } from '../generator'

/**
 * Picks a random character from the characters array for each cell in the grid.
 */
export class Scramble extends Generator {
  #cells = []

  generate () {
    super.generate()

    const characters = Array.from(this.characters)
    for (let index = 0; index < this.configuration.size; index++) {
      const characterIndex = Math.floor(this.rand() * characters.length)
      const [character] = characters.splice(characterIndex, 1)
      this.#cells.push(new Cell.State(index, character))
    }

    return new Grid.State.Configuration(this.#cells, this.words)
  }
}
