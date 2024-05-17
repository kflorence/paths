import { lettersByCharacter } from './letter'
import { Cell } from './cell'

export class Word {
  content
  indexes = []
  points

  constructor (width, cells) {
    const content = []
    const pointScoringLetters = []
    cells.forEach((cell) => {
      const character = cell.getContent()
      content.push(character)
      const letter = lettersByCharacter[character]
      if (!cell.getFlags().has(Cell.Flags.Swapped)) {
        // Points are only scored for letters that are not swapped
        pointScoringLetters.push(letter)
      }
      this.indexes.push(cell.getIndex())
    })

    this.content = content.join('')

    const lengthMultiplier = Math.floor(pointScoringLetters.length / Word.widthMultiplier(width))
    this.points = pointScoringLetters.reduce((points, letter) => points + letter.points, 0) * lengthMultiplier
  }

  static widthMultiplier (width) {
    return Math.floor(width / 2)
  }

  static minimumLength = 3
}
