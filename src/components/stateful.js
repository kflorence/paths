export class Stateful {
  #current
  #original

  constructor (state) {
    this.setState(state)
    this.#original = this.getState()
  }

  getOriginalState () {
    return structuredClone(this.#original)
  }

  getState () {
    return structuredClone(this.#current)
  }

  setState (state) {
    this.#current = structuredClone(state)
  }

  updateState (updater, dispatchEvent = true) {
    this.#current = updater(this.#current) ?? this.#current

    if (dispatchEvent) {
      document.dispatchEvent(new CustomEvent(Stateful.Events.Update, { object: this }))
    }

    return this.getState()
  }

  static Events = Object.freeze({ Update: 'state-update' })
}
