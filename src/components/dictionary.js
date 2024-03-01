import words from 'bundle-text:word-list/words.txt'

export class Dictionary {
  words = words.split('\n')

  isValid (word) {
    return this.words.includes(word)
  }
}
