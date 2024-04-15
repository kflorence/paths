let nextValue = 0

export class Flag {
  name
  value

  constructor (name) {
    this.name = name
    this.value = 1 << nextValue++
  }
}

export class Flags {
  #value

  constructor (...flags) {
    this.set(...flags)
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

  set (...flags) {
    this.#value = 0
    flags.forEach((flag) => {
      if (typeof flag === 'number') {
        this.#value = flag
      } else if (flag instanceof Flags) {
        this.#value = flag.get()
      } else if (flag instanceof Flag) {
        this.add(flag)
      }
    })
    return this
  }

  toString (flags) {
    return flags.flatMap((flag) => this.has(flag) ? [flag.name] : []).join(',')
  }
}
