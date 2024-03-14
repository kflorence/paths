import { Game } from './game'

const localStorage = window.localStorage
const location = window.location
const params = new URLSearchParams(location.search)

export class State {
  key

  #current
  #original

  constructor (key, state) {
    this.key = key
    this.#current = structuredClone(state)
    this.#original = structuredClone(state)

    this.load()
  }

  get () {
    return structuredClone(this.#current)
  }

  load () {
    const cache = params.get(Game.Params.state) ?? localStorage.getItem(this.key)
    if (cache) {
      console.debug('Loading state from cache. seed:', this.key, cache)
      try {
        const state = JSON.parse(cache)
        if (state.seed === this.key) {
          this.set(state)
        } else {
          console.warn('Ignoring cached state due to seed mismatch. ours:', this.key, 'theirs:', state.seed)
        }
      } catch (e) {
        console.error('Could not set state from localStorage', this.key, e.message)
      }
    }
  }

  reset () {
    this.set(this.#original)
  }

  set (state) {
    this.#current = structuredClone(state)
    if (!params.has(Game.Params.state)) {
      // Don't overwrite local state with cached state loaded from URL
      localStorage.setItem(this.key, JSON.stringify(this.#current))
    }
    return this.get()
  }
}
