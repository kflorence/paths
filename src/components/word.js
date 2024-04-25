import wordsTxt from 'bundle-text:word-list/words.txt'
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

  static isValid (word) {
    return word.length >= Word.minimumLength && words.includes(word)
  }

  static widthMultiplier (width) {
    return Math.floor(width / 2)
  }

  static minimumLength = 3
}

// Each word is delimited by a newline
const words = wordsTxt.split('\n').filter((word) => word.length >= Word.minimumLength)

/**
 * Gets random words from the words dictionary until the length is met.
 * @param rand A PRNG used to pick random words from the dictionary.
 * @param length The exact total length of the picked words.
 * @returns {*[]|*} An array of words.
 */
export function getWords (rand, length) {
  let availableWords = Array.from(words)
  let count = 0

  const result = []
  function next () {
    let maximumWordLength = length - count - Word.minimumLength
    if (maximumWordLength >= Word.minimumLength) {
      availableWords = availableWords.filter((word) => word.length <= maximumWordLength)
    } else {
      maximumWordLength = maximumWordLength + Word.minimumLength
      availableWords = availableWords.filter((word) => word.length === maximumWordLength)
    }

    console.debug(
      `getWords ${result.length}: ` +
        `count = ${count}/${length}, ` +
        `maximumWordLength = ${maximumWordLength}, ` +
        `availableWords = ${availableWords.length}`
    )

    const nextWordIndex = Math.floor(rand() * availableWords.length)
    const nextWord = availableWords[nextWordIndex]

    console.debug(`getWords picked word '${nextWord}' at index ${nextWordIndex}.`)

    result.push(nextWord)
    count += nextWord.length

    if (count === length) {
      console.debug(`getWords result: ${result.join(', ')}`)
      return result
    }

    return next()
  }

  return next()
}
