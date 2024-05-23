import { splitmix32 } from './util'

export class Generator {
  characters
  configuration
  dictionary
  rand
  wordBoundaries
  wordBoundaryIndexes
  words

  constructor (configuration, dictionary) {
    this.rand = splitmix32(configuration.hash)
    this.words = dictionary.getWords(this.rand, configuration.size)
    this.characters = this.words.reduce((characters, word) => characters.concat(word.split('')), [])
    this.configuration = configuration
    this.dictionary = dictionary
    this.wordBoundaries = Generator.getWordBoundaries(this.configuration.words)
    this.wordBoundaryIndexes = Object.keys(this.wordBoundaries).map(Number).sort((a, b) => a - b)
  }

  /**
   * Generate grid state configuration.
   * @returns {Grid.State.Configuration}
   */
  generate () {
    throw new Error('Use concrete implementation')
  }

  getWordIndex (characterIndex) {
    return this.wordBoundaries[this.wordBoundaryIndexes.find((index) => index >= characterIndex)]
  }

  /**
   *
   * @param words
   * @returns {{[p: string]: any}}
   */
  static getWordBoundaries (words) {
    return Object.fromEntries(words.reduce((entries, word, index) => {
      const [previousBoundary] = entries[entries.length - 1] ?? [-1]
      entries.push([previousBoundary + word.length, index])
      return entries
    }, []))
  }
}
