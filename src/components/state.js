import { base64decode, base64encode } from './util'

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

    params.filter((param) => State.params.has(param.name)).forEach((param) => {
      const raw = State.params.get(param.name)
      const value = param.isEncoded ? State.decode(raw) : raw
      console.debug(`Setting key '${param.key}' for URL param '${param.name}'.`, value)
      this.set(param.key, param.isJson ? JSON.parse(value) : value)
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

  static decode (value) {
    return base64decode(value)
  }

  static encode (value) {
    return base64encode(value)
  }

  static reload () {
    location.assign(State.url.search)
  }

  static Param = class {
    key
    name
    isEncoded
    isJson

    constructor (key, name, isEncoded, isJson) {
      this.key = key
      this.name = name ?? key
      this.isEncoded = isEncoded === true
      this.isJson = isJson === true
    }
  }

  static Params = Object.freeze({
    Expand: 'expand',
    Id: 'id',
    State: 'state',
    Width: 'width'
  })
}
