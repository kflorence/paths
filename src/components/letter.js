class Letter {
  character
  frequency
  points
  weight

  constructor (character) {
    this.character = character
    this.frequency = Letter.frequencies[character]

    // Assign points to the letter based on which tier it falls into. Every letter is worth at least one point and
    // will gain an additional point for each cumulative tier it is in.
    this.points = Letter.pointTiers.reduce((points, tier) => points + (this.frequency < tier ? 1 : 0), 1)

    // Calculate the weight of the letter based on the cumulative frequency of this letter and all those before it.
    // Weight is on a sliding scale between 0 and 1.
    const characters = Letter.characters.slice(0, Letter.characters.indexOf(character) + 1)
    this.weight = characters.reduce((weight, character) => weight + Letter.frequencies[character], 0)
  }

  /**
   * Stores letters by their frequency of usage. The values must add up to 1.
   * @see https://en.wikipedia.org/wiki/Letter_frequency#Relative_frequencies_of_letters_in_the_English_language
   * @type {Object.<string, number>}
   */
  static frequencies = Object.freeze({
    a: 0.08167,
    b: 0.01492,
    c: 0.02782,
    d: 0.04253,
    e: 0.12702,
    f: 0.02228,
    g: 0.02015,
    h: 0.06094,
    i: 0.06966,
    j: 0.00153,
    k: 0.00772,
    l: 0.04025,
    m: 0.02406,
    n: 0.06749,
    o: 0.07507,
    p: 0.01929,
    q: 0.00095,
    r: 0.05987,
    s: 0.06327,
    t: 0.09056,
    u: 0.02758,
    v: 0.00978,
    w: 0.02360,
    x: 0.00150,
    y: 0.01974,
    z: 0.00074
  })

  static characters = Object.freeze(Object.keys(Letter.frequencies))

  /**
   * Defines point tiers based on letter frequency percentage.
   * @type {number[]} Frequency tiers.
   */
  static pointTiers = [0.1, 0.5, 1, 4, 8].map((n) => n / 100)
}

export const lettersByCharacter = Object.fromEntries(Letter.characters.map((character) => [
  character,
  new Letter(character)
]))

export const letters = Object.values(lettersByCharacter)
