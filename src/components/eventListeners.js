export class EventListeners {
  #events = []
  #options = {
    context: undefined,
    element: document
  }

  constructor (options = {}, events = []) {
    this.#options = Object.assign(this.#options, options)
    this.add(events)
  }

  add (options = {}, events = []) {
    // Allow omission of options
    if (Array.isArray(options)) {
      events = options
      options = {}
    }

    if (events.length === 0) {
      return
    }

    this.#events = this.#events.concat(events.map((event) => {
      event = Object.assign({}, this.#options, options, event)
      if (!event.type) {
        throw new Error('Event type is required')
      } else if (!Array.isArray(event.type)) {
        event.type = [event.type]
      }
      if (event.context) {
        event.handler = event.handler.bind(event.context)
      }
      event.type.forEach((type) => event.element.addEventListener(type, event.handler, event.options))
      return event
    }))
  }

  remove () {
    this.#events.forEach((event) =>
      event.type.forEach((type) => event.element.removeEventListener(type, event.handler))
    )
    this.#events = []
  }
}
