export class Flag {
  name
  value

  constructor (name, value) {
    this.name = name
    this.value = 1 << value
  }
}

export class Flags {
  #value

  constructor (value = 0) {
    this.set(value)
  }

  add (...flags) {
    flags.forEach((flag) => { this.#value |= flag.value })
    return this
  }

  get () {
    return this.#value
  }

  has (...flags) {
    return flags.some((flag) => (this.#value & flag.value) > 0)
  }

  remove (...flags) {
    flags.forEach((flag) => { this.#value &= ~flag.value })
    return this
  }

  set (value) {
    this.#value = (value instanceof Flags) ? value.get() : value
  }
}
