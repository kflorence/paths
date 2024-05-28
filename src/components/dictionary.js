import { shuffle } from './util'
import { Word } from './word'

export class Dictionary {
  sources = {}
  words = []

  async load (source) {
    if (this.sources[source.name]) {
      console.debug(`Dictionary '${source.name}' has already been loaded.`)
      return
    }

    console.debug(`Loading dictionary '${source.name}' from URL: '${source.url}'`)
    try {
      // Always use cached copy if it exists
      const response = await fetch(source.url, { cache: 'force-cache' })
      const text = await response.text()
      const startIndex = this.words.length
      this.words = Array.from(
        new Set(this.words.concat(text.split('\n').filter((word) => word.length >= Word.minimumLength)))
      )
      const range = new Dictionary.Range(startIndex, this.words.length - 1)
      this.sources[source.name] = source.withRange(range)
      console.debug(`Words loaded. New word count: ${this.words.length}`)
    } catch (e) {
      console.error(`Could not load words for dictionary '${source.name}' from URL '${source.url}'`, e.message)
    }
  }

  /**
   * Gets random words from the words dictionary until the length is met.
   * @param rand A PRNG used to choose indexes from the set of words.
   * @param length The exact total length of the picked words.
   * @returns {*[]|*} An array of words.
   */
  getWords (rand, length) {
    let availableWords = Array.from(this.words)
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
        // Shuffle the results, since the algorithm is biased towards putting the shortest word last.
        shuffle(rand, result)
        console.debug(`getWords result: ${result.join(', ')}`)
        return result
      }

      return next()
    }

    return next()
  }

  getSource (word) {
    const index = this.words.indexOf(word)
    if (index < 0) {
      return
    }

    for (const name in this.sources) {
      if (this.sources[name]?.range.contains(index)) {
        return name
      }
    }
  }

  isValid (word) {
    return word.length >= Word.minimumLength && this.words.includes(word)
  }

  unload (name) {
    const source = this.sources[name]
    if (!source) {
      console.warn(`Dictionary '${name}' has not been loaded.`)
      return
    }

    console.debug(`Unloading dictionary '${source.name}'. Current word count: ${this.words.length}`)
    source.range.extract(this.words)
    delete this.sources[source.name]

    // Update any sources after this one
    for (const name in this.sources) {
      const other = this.sources[name]
      if (other.range.startIndex > source.range.startIndex) {
        const range = other.range.offset(-source.range.count)
        console.debug(
          `Updating range for dictionary '${other.name}' from (${other.range.toString()}) to (${range.toString()}).`)
        this.sources[name] = other.withRange(range)
      }
    }

    console.debug(`Words unloaded. New word count: ${this.words.length}`)
  }

  static Range = class {
    endIndex
    count
    startIndex

    constructor (startIndex, endIndex) {
      this.startIndex = startIndex
      this.endIndex = endIndex
      this.count = (endIndex - startIndex) + 1
    }

    contains (index) {
      return index >= this.startIndex && index <= this.endIndex
    }

    extract (words) {
      words.splice(this.startIndex, this.count)
    }

    offset (count) {
      return new Dictionary.Range(this.startIndex + count, this.endIndex + count)
    }

    toString () {
      return [this.startIndex, this.endIndex].join(',')
    }
  }

  static Source = class {
    name
    range
    url

    constructor (name, url, range) {
      this.name = name
      this.url = url
      this.range = range
    }

    withRange (range) {
      return new Dictionary.Source(this.name, this.url, range)
    }
  }

  static Names = Object.freeze({
    Default: 'default',
    Profanity: 'profanity'
  })

  static Sources = Object.freeze({
    Default: new Dictionary.Source(
      Dictionary.Names.Default,
      'https://raw.githubusercontent.com/kflorence/word-list/main/words.txt?v=1'
    ),
    Profanity: new Dictionary.Source(
      Dictionary.Names.Profanity,
      'https://raw.githubusercontent.com/kflorence/word-list/main/words-profanity.txt?v=1'
    )
  })
}
