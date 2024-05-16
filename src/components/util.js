import pako from 'pako'

const navigator = window.navigator

export function getClassName (...parts) {
  return parts.join('-')
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

export function randomIntInclusive (rand, max, min = 0) {
  return Math.floor(rand() * (max - min + 1) + min)
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

export async function writeToClipboard (string) {
  try {
    await navigator.clipboard.writeText(string)
  } catch (error) {
    console.error('Could not write to clipboard.', error.message)
  }
}
