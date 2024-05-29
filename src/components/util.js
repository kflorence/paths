import pako from 'pako'

export const history = window.history
const location = window.location
export const localStorage = window.localStorage
const navigator = window.navigator

export const url = new URL(location)
export const urlParams = url.searchParams

export function arrayEquals (a, b, sort) {
  if (typeof sort === 'function') {
    a = a.toSorted(sort)
    b = b.toSorted(sort)
  }
  return a.length === b.length && a.every((value, index) => b[index] === value)
}

export function arrayIncludes (a, b, sort) {
  return a.some((v) => arrayEquals(v, b, sort))
}

/**
 * cyrb53 (c) 2018 bryc (github.com/bryc)
 * License: Public domain. Attribution appreciated.
 * A fast and simple 53-bit string hash function with decent collision resistance.
 * Largely inspired by MurmurHash2/3, but with a focus on speed/simplicity.
 */
export function cyrb53 (str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function getBaseUrl () {
  return new URL(location.href.split(/[?#]/)[0])
}

export function getClassName (...parts) {
  return parts.join('-')
}

export function getIndexesUnique (rand, array, max) {
  const available = Object.keys(array)
  if (max > available.length) {
    max = available.length
  }

  const picked = []
  for (; max > 0; max--) {
    picked.push(Number(available.splice(randomIntInclusive(rand, available.length - 1), 1)[0]))
  }

  return picked
}

export function getSign (num) {
  const sign = Math.sign(num)
  if (sign === 0) {
    return '='
  } else if (sign > 0) {
    return '+'
  } else {
    return '-'
  }
}

export function base64decode (string) {
  const binString = window.atob(base64unescape(string))
  // noinspection JSCheckFunctionSignatures
  return new TextDecoder().decode(pako.inflate(Uint8Array.from(binString, (c) => c.codePointAt(0))))
}

export function base64encode (string) {
  return base64escape(window.btoa(String.fromCodePoint(...pako.deflate(new TextEncoder().encode(string)))))
}

function base64escape (string) {
  // https://en.wikipedia.org/wiki/Base64#URL_applications
  return string.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64unescape (string) {
  return (string + '==='.slice((string.length + 3) % 4))
    .replace(/-/g, '+').replace(/_/g, '/')
}

export function optionally (value, func) {
  return value === undefined ? value : func(value)
}

export function randomIntInclusive (rand, max, min = 0) {
  return Math.floor(rand() * (max - min + 1) + min)
}

export function reload () {
  location.assign(url.search)
}

export function reverseString (str) {
  return str.split('').reverse().join('')
}

export function shuffle (rand, array) {
  // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

export function sortNumerically (a, b) {
  return Number(a) - Number(b)
}

/**
 * A seeded pseudo-random number generator.
 * @see https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 * @param a the seed value
 * @returns {function(): *} a function which generates static pseudo-random numbers per seed and call
 */
export function splitmix32 (a) {
  return function () {
    a |= 0
    a = a + 0x9e3779b9 | 0
    let t = a ^ a >>> 16
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ t >>> 15
    t = Math.imul(t, 0x735a2d97)
    return ((t ^ t >>> 15) >>> 0) / 4294967296
  }
}

export async function writeToClipboard (string) {
  try {
    await navigator.clipboard.writeText(string)
  } catch (error) {
    console.error('Could not write to clipboard.', error.message)
  }
}
