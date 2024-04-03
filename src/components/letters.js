/**
 * Stores letters by their frequency of usage. The values must add up to 1.
 * @see https://en.wikipedia.org/wiki/Letter_frequency#Relative_frequencies_of_letters_in_the_English_language
 * @type {Object.<string, number>}
 */
export const lettersByFrequency = {
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
}

const letters = Object.keys(lettersByFrequency)

/**
 * All letters start at 1 point and gain additional points based on which frequency buckets they fall into.
 * @type {number[]} An array of frequency buckets
 */
const scoreFrequencyBuckets = [0.1, 0.5, 1, 4, 8].map((n) => n / 100)

/**
 * Stores letters by their score. The score is derived by creating buckets based on letter frequency.
 * @type {Object.<string, number>}
 */
export const lettersByScore = {}
letters.forEach((letter) => {
  lettersByScore[letter] = scoreFrequencyBuckets
    .reduce((score, bucket) => score + (lettersByFrequency[letter] < bucket ? 1 : 0), 1)
})

/**
 * Stores letters by their cumulative frequency (weight). For example, given the following letters and frequencies:
 * A = 0.1
 * B = 0.4
 * C = 0.5
 *
 * The resulting weights would be:
 * A = 0.1
 * B = 0.5 (0.1 + 0.4)
 * C = 1.0 (0.1 + 0.4 + 0.5)
 *
 * @type {Object.<string, number>}
 */
export const lettersByWeight = {}
letters.reduce((acc, letter) => (lettersByWeight[letter] = acc + lettersByFrequency[letter]), 0)
