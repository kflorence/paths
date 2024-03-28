import { Game } from './game'

const localStorage = window.localStorage
const location = window.location
const params = new URLSearchParams(location.search)

export class State {
  key
  #value

  constructor (value, key) {
    this.key = key
    this.#value = structuredClone(value)

    this.load()
  }

  get () {
    return structuredClone(this.#value)
  }

  load () {
    if (this.key === undefined) {
      return
    }

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

  set (state) {
    this.#value = structuredClone(state)
    if (this.key !== undefined && !params.has(Game.Params.state)) {
      // Don't overwrite local state with cached state loaded from URL
      localStorage.setItem(this.key, JSON.stringify(this.#value))
    }
    return this.get()
  }

  update (f) {
    return this.set(f(this.get()))
  }
}
