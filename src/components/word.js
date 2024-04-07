import wordsTxt from 'bundle-text:word-list/words.txt'
import { lettersByCharacter } from './letter'
import { Cell } from './cell'

// Each word is delimited by a newline
const words = wordsTxt.split('\n')

export class Word {
  content
  indexes = []
  points

  constructor (cells) {
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

    const lengthMultiplier = Math.floor(pointScoringLetters.length / 3)
    this.points = pointScoringLetters.reduce((points, letter) => points + letter.points, 0) * lengthMultiplier
  }

  static isValid (word) {
    return word.length > 2 && words.includes(word)
  }
}
