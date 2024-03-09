import { Grid } from './grid'
import { Stateful } from './stateful'

const localStorage = window.localStorage
const location = window.location
const params = new URLSearchParams(location.search)

export class State extends Stateful {
  constructor () {
    let id = params.get(State.Keys.id) ?? State.defaultId()
    const date = Date.parse(id)
    if (!isNaN(date) && date > State.today) {
      console.debug(`Defaulting to current day puzzle given ID in the future: ${id}`)
      id = State.defaultId()
    }

    // Load existing state from localStorage, otherwise generate a new one
    const width = params.get(State.Keys.width)
    const state = localStorage.getItem(Grid.Generator.getSeed(id, width))
    super(state ? JSON.parse(state) : new Grid.Generator(id, width))
  }

  setState (state) {
    super.setState(state)
    localStorage.setItem(state.seed, JSON.stringify(state))
  }

  updateState (updater, dispatchEvent = true) {
    const state = super.updateState(updater, dispatchEvent)
    localStorage.setItem(state.seed, JSON.stringify(state))
    return state
  }

  static defaultId () {
    // The ID for the daily puzzle
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  static today = Date.parse(State.defaultId())

  static Keys = Object.freeze({
    id: 'id',
    seed: 'seed',
    width: 'width'
  })
}
