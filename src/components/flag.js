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

  constructor (value) {
    this.set(value ?? 0)
  }

  add (...flags) {
    flags.forEach((flag) => { this.#value |= flag })
    return this
  }

  get () {
    return this.#value
  }

  has (flag) {
    return (this.#value & flag) > 0
  }

  remove (...flags) {
    flags.forEach((flag) => { this.#value &= ~flag })
    return this
  }

  set (value) {
    this.#value = value
  }
}
