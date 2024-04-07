const localStorage = window.localStorage
const location = window.location

export class State {
  key

  #ephemeral
  #value

  constructor (key, value, params = [], ephemeral = false) {
    this.key = key

    this.#ephemeral = ephemeral
    this.#value = structuredClone(value)

    if (key !== undefined) {
      const value = localStorage.getItem(key)
      if (value) {
        console.debug(`Found local cache for key '${key}'.`, value)
        try {
          this.set(JSON.parse(value))
        } catch (e) {
          console.debug(`Could not parse cache for key '${key}'.`, e.message)
        }
      }
    }

    params
      .map((param) => typeof param === 'object' ? param : { key: param, name: param })
      .filter((param) => {
        if (param.key === undefined || param.name === undefined) {
          console.debug('Ignoring invalid param', param)
          return false
        }

        return State.params.has(param.name)
      })
      .forEach((param) => {
        if (State.params.has(param.name)) {
          const value = State.params.get(param.name)
          console.debug(`Setting key '${param.key}' for URL param '${param.name}'.`, value)
          try {
            this.set(param.key, JSON.parse(value))
          } catch (e) {
            this.set(param.key, value)
          }
        }
      })
  }

  get (key) {
    return structuredClone(key === undefined ? this.#value : this.#value[key])
  }

  set (key, value) {
    if (value === undefined) {
      value = key
      key = this.key
    }

    const isRootKey = key === this.key

    value = structuredClone(value)
    if (isRootKey) {
      this.#value = value
    } else {
      this.#value[key] = value
    }

    if (!this.#ephemeral) {
      // Local storage will not be updated if state is set to ephemeral
      localStorage.setItem(this.key, JSON.stringify(this.#value))
    }

    return this.get()
  }

  update (f) {
    return this.set(f(this.get()))
  }

  static url = new URL(location)
  static params = State.url.searchParams
}
