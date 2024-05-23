import { localStorage } from './util'
import { Cache } from './cache'

export class State {
  #cache
  #persistence
  #value

  constructor (key, defaultValue, options) {
    options = Object.assign({ encoding: [], overrides: [], persistence: true }, options)
    this.#cache = new Cache(key, localStorage.getItem, localStorage.setItem, options.encoding)
    this.#persistence = options.persistence !== false
    this.#value = structuredClone(defaultValue)

    if (this.#persistence) {
      try {
        const value = this.#cache.get()
        console.debug(`Found local cache for key '${key}'.`, value)
        this.set(value)
      } catch (e) {
        console.error(`Could not load cache for key '${key}': ${e.message}`)
      }
    }

    const overrides = options.overrides ?? []
    overrides.forEach((cache) => {
      try {
        const value = cache.get()
        console.debug(`Overriding local cache at key '${cache.key}'.`, value)
        this.set(cache.key, value)
      } catch (e) {
        console.error(`Could not override local cache at key '${cache.key}': ${e.message}`)
      }
    })
  }

  get (key) {
    return structuredClone(key === undefined ? this.#value : this.#value[key])
  }

  set (key, value) {
    if (arguments.length === 1) {
      value = key
      key = this.#cache.key
    }

    if (value === undefined) {
      return
    }

    const isCacheKey = key === this.#cache.key

    value = structuredClone(value)
    if (isCacheKey) {
      this.#value = value
    } else {
      this.#value[key] = value
    }

    if (this.#persistence) {
      this.#cache.set(this.#value)
    }

    return this.get()
  }

  update (updater) {
    return this.set(updater(this.get()))
  }
}
