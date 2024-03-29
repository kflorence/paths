import words from 'bundle-text:word-list/words.txt'

export class Dictionary {
  static #words = words.split('\n')

  static isValid (word) {
    return Dictionary.#words.includes(word)
  }
}
