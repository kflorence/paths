import { Grid } from './grid'
import { EventListeners } from './eventListeners'

const $footer = document.getElementById('footer')
const $id = document.getElementById('id')
const $reset = document.getElementById('reset')
const $score = document.getElementById('score')
const $words = document.getElementById('words')

const location = window.location
const params = new URLSearchParams(location.search)

export class Game {
  #eventListeners = new EventListeners({ context: this })
  #grid
  #words = []

  constructor () {
    let id = params.get(Game.Params.id) ?? Game.defaultId()
    const date = Date.parse(id)
    if (!isNaN(date) && date > Game.today) {
      console.debug(`Defaulting to current day puzzle given ID in the future: ${id}`)
      id = Game.defaultId()
    }

    this.#grid = new Grid(id, params.get(Game.Params.width))

    $id.href = `?id=${id}`
    $id.textContent = id

    this.#eventListeners.add([
      { type: 'click', element: $reset, handler: this.reset }
    ])

    this.update()
  }

  reset () {
    this.#grid.reset()
    this.update()
  }

  update () {
    // this.#grid.update(this.#state)
    //
    // const lastIndex = this.#path.length - 1
    // if (this.#pointer < lastIndex) {
    //   // Update the state of the cells in the DOM
    //   this.#path.forEach((cells, rowIndex) => {
    //     const lastColumnIndex = cells.length - 1
    //     cells.forEach((cell, columnIndex) => {
    //       const classNames = [Cell.ClassNames.Word]
    //       if (columnIndex < lastColumnIndex) {
    //         if (columnIndex === 0) {
    //           if (rowIndex === 0) {
    //             classNames.push(Cell.ClassNames.First)
    //           }
    //           classNames.push(Cell.ClassNames.WordStart)
    //         }
    //       } else {
    //         if (rowIndex === lastRowIndex) {
    //           classNames.push(Cell.ClassNames.Last)
    //         }
    //         classNames.push(Cell.ClassNames.WordEnd)
    //       }
    //
    //       const nextCell = cells[columnIndex + 1] ?? this.#path[rowIndex + 1]?.[0]
    //       if (nextCell) {
    //         classNames.push(cell.getDirection(nextCell))
    //       }
    //
    //       cell.removeClassNamesExcept(Cell.ClassNames.Cell, Cell.ClassNames.Selected)
    //       cell.addClassNames(...classNames)
    //       cell.setSelected([rowIndex, columnIndex].join(','))
    //     })
    //   })
    //
    //   this.#pointer = lastIndex
    // }
    //
    // this.#updateScore()
    //
    // this.#state.set(Object.assign(this.#state.get(), { grid: this.#grid.getState() }))
  }

  #updateScore () {
    // Newest at top
    $words.replaceChildren(...this.#words.map((word) => {
      const $element = document.createElement('li')
      $element.textContent = word
      return $element
    }))
  }

  #updateState (cells) {
    // TODO: update state
  }

  static defaultId () {
    // The ID for the daily puzzle
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  static today = Date.parse(Game.defaultId())

  static Params = Object.freeze({
    expanded: 'expanded',
    id: 'id',
    seed: 'seed',
    state: 'state',
    width: 'width'
  })
}

if ([Game.Params.expanded, Game.Params.state].some((param) => params.has(param))) {
  $footer.classList.add(Game.Params.expanded)
}

$score.addEventListener('click', () => {
  $footer.classList.toggle(Game.Params.expanded)
})
