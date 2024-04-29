import { base64decode, base64encode } from './util'

const history = window.history
const localStorage = window.localStorage
const location = window.location

export class State {
  key

  #ephemeral
  #value

  constructor (key, value, options = {}) {
    this.key = key

    this.#ephemeral = options.ephemeral === true
    this.#value = structuredClone(value)

    if (!this.#ephemeral && key !== undefined) {
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

    const params = options.params ?? {}
    for (const key in params) {
      const value = State.getParam(params[key])
      if (value !== undefined) {
        this.set(key, value)
      }
    }
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

  static getParam (param) {
    if (!State.params.has(param.name)) {
      return
    }

    return State.#getValue(param, State.params.get(param.name))
  }

  static getStorage (param) {
    const value = localStorage.getItem(param.name)
    console.log(param, value)
    if (value !== null) {
      return State.#getValue(param, value)
    }
  }

  static #getValue (param, value) {
    const decoded = param.isEncoded ? State.decode(value) : value
    return param.isJson ? JSON.parse(decoded) : decoded
  }

  static reload () {
    location.assign(State.url.search)
  }

  static setParam (param, value) {
    if (!State.params.has(param.name)) {
      return
    }

    if (param.isJson) {
      value = JSON.stringify(value)
    }

    if (param.isEncoded) {
      value = State.encode(value)
    }

    State.params.set(param.name, value)
    history.pushState({ [param.name]: value }, '', State.url)
  }

  static Param = class {
    name
    isEncoded
    isJson

    constructor (name, isEncoded, isJson) {
      this.name = name
      this.isEncoded = isEncoded === true
      this.isJson = isJson === true
    }
  }

  static Params = Object.freeze({
    Debug: 'debug',
    Expand: 'expand',
    Id: 'id',
    State: 'state',
    Width: 'width'
  })
}
