import { lettersByCharacter } from './letter'
import { Cell } from './cell'
import { Grid } from './grid'

export class Word {
  content
  indexes = []
  move
  points

  constructor (width, cells, move) {
    const content = []
    const pointScoringLetters = []
    cells.forEach((cell) => {
      const character = cell.getContent()
      content.push(character)
      const letter = lettersByCharacter[character]
      if (!cell.getFlags().has(Cell.Flags.Swapped) || move.value.match === Grid.Match.Exact) {
        // Points are only scored for letters that are not swapped, unless the word exactly matches a secret word.
        pointScoringLetters.push(letter)
      }
      this.indexes.push(cell.getIndex())
    })

    this.content = content.join('')
    this.move = move

    const lengthMultiplier = Math.floor(pointScoringLetters.length / Word.widthMultiplier(width))
    this.points = pointScoringLetters.reduce((points, letter) => points + letter.points, 0) * lengthMultiplier
  }

  static widthMultiplier (width) {
    return Math.floor(width / 2)
  }

  static minimumLength = 3
}
