import { splitmix32 } from './util'

export class Generator {
  characters
  configuration
  dictionary
  rand
  wordBoundaries
  words

  constructor (configuration, dictionary) {
    this.rand = splitmix32(configuration.hash)
    this.words = dictionary.getWords(this.rand, configuration.size)
    this.characters = this.words.reduce((characters, word) => characters.concat(word.split('')), [])
    this.configuration = configuration
    this.dictionary = dictionary
    this.wordBoundaries = Generator.getWordBoundaries(this.words)
  }

  /**
   * Generate grid state configuration.
   * @returns {Grid.State.Configuration}
   */
  generate () {
    throw new Error('Use concrete implementation')
  }

  getWordIndex (characterIndex) {
    return this.wordBoundaries.findIndex((boundary) => boundary.includes(characterIndex))
  }

  static getWordBoundaries (words) {
    return words.reduce((boundaries, word) => {
      const last = boundaries[boundaries.length - 1]
      const lastIndex = last ? last[last.length - 1] + 1 : 0
      boundaries.push([...word.split('').map((_, index) => lastIndex + index)])
      return boundaries
    }, [])
  }
}
