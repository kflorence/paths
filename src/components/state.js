const localStorage = window.localStorage
const location = window.location
const params = new URLSearchParams(location.search)

export class State {
  key

  #ephemeralParamKeys
  #value

  constructor (key, value, paramKeys = [], ephemeralParamKeys = []) {
    this.key = key

    this.#ephemeralParamKeys = ephemeralParamKeys
    this.#value = structuredClone(value)

    if (key !== undefined) {
      paramKeys.unshift(key)
    }

    paramKeys.forEach((key) => {
      const isStateKey = key === this.key
      const value = isStateKey ? localStorage.getItem(key) : params.get(key)
      if (value) {
        console.debug(`Found cache for key: ${key}`)
        console.debug(value)
        try {
          if (isStateKey) {
            this.#value = JSON.parse(value)
          } else {
            this.set(key, value)
          }
        } catch (e) {
          console.error(`Could not set state for key: ${key}`, e.message)
        }
      }
    })
  }

  get (key) {
    return structuredClone(key === undefined ? this.#value : this.#value[key])
  }

  set (key, state) {
    if (state === undefined) {
      state = key
      key = undefined
    }

    state = structuredClone(state)
    if (key === undefined || key === this.key) {
      this.#value = state
    } else {
      this.#value[key] = state
    }

    if (!this.#ephemeralParamKeys.includes(key) || !params.get(key)) {
      // Don't update local storage when updating ephemeral param keys that are present in the URL
      localStorage.setItem(this.key, JSON.stringify(this.#value))
    }

    return this.get()
  }

  update (f) {
    return this.set(f(this.get()))
  }
}
