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

class Range {
  constructor (start, end) {
    this.start = start
    this.end = end
  }

  contains (index) {
    return index >= this.start && index <= this.end
  }
}

class Dictionary {
  name
  url

  constructor (name, url) {
    this.name = name
    this.url = url
  }
}

export const DictionaryNames = Object.freeze({
  Default: 'default',
  Profanity: 'profanity'
})

export const Dictionaries = Object.freeze({
  Default: new Dictionary(
    DictionaryNames.Default,
    'https://raw.githubusercontent.com/kflorence/word-list/main/words.txt?v=1'
  ),
  Profanity: new Dictionary(
    DictionaryNames.Profanity,
    'https://raw.githubusercontent.com/kflorence/word-list/main/words-profanity.txt?v=1'
  )
})

export class Words {
  dictionaries = {}
  values = []

  async load (dictionary) {
    if (this.dictionaries[dictionary.name]) {
      console.debug(`Dictionary '${dictionary.name}' has already been loaded.`)
      return
    }

    console.debug(`Words is loading dictionary '${dictionary.name}' from URL: '${dictionary.url}'`)
    try {
      // Always use cached copy if it exists
      const response = await fetch(dictionary.url, { cache: 'force-cache' })
      const text = await response.text()
      const startIndex = this.values.length - 1
      this.values = Array.from(
        new Set(this.values.concat(text.split('\n').filter((word) => word.length >= Word.minimumLength)))
      )
      this.dictionaries[dictionary.name] = new Range(startIndex, this.values.length - 1)
      console.debug(`Words loaded. New word count: ${this.values.length}`)
    } catch (e) {
      console.error(`Could not load words for dictionary '${dictionary.name}' from URL '${dictionary.url}'`, e.message)
    }
  }

  /**
   * Gets random words from the words dictionary until the length is met.
   * @param rand A PRNG used to choose indexes from the set of words.
   * @param length The exact total length of the picked words.
   * @returns {*[]|*} An array of words.
   */
  getRandom (rand, length) {
    let availableWords = Array.from(this.values)
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
      availableWords.splice(nextWordIndex, 1)

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

  getDictionary (word) {
    const index = this.values.indexOf(word)
    if (index < 0) {
      return
    }

    for (const name in this.dictionaries) {
      if (this.dictionaries[name].contains(index)) {
        return name
      }
    }
  }

  isValid (word) {
    return word.length >= Word.minimumLength && this.values.includes(word)
  }

  unload (dictionary) {
    const range = this.dictionaries[dictionary.name]
    if (!range) {
      return
    }

    console.debug(`Unloading dictionary '${dictionary.name}'. Current length: ${this.values.length}`)
    this.values.splice(range.start, (range.end - range.start) + 1)
    delete this.dictionaries[dictionary.name]
    console.debug(`Done unloading. New length: ${this.values.length}`)
  }
}
