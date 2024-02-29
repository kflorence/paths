import en from 'dictionary-en'
import nspell from 'nspell'

const dictionaries = { en }

export class Dictionary {
  #dictionary

  language

  constructor (language = Dictionary.Languages.English) {
    this.language = language
    this.#dictionary = nspell(dictionaries[this.language])
  }

  isValid (word) {
    return this.#dictionary.correct(word)
  }

  static Languages = Object.freeze({ English: 'en' })
}
