import { Grid } from './grid'
import { Cell } from './cell'
import { Dictionary } from './dictionary'
import { EventListeners } from './eventListeners'
import { State } from './state'

const $footer = document.getElementById('footer')
const $grid = document.getElementById('grid')
const $id = document.getElementById('id')
const $reset = document.getElementById('reset')
const $score = document.getElementById('score')
const $words = document.getElementById('words')

const location = window.location
const params = new URLSearchParams(location.search)

export class Game {
  #dictionary
  #eventListeners = new EventListeners({ context: this, element: $grid })
  #grid
  #path = []
  #pointer
  #selection = []
  #state
  #words = []

  constructor () {
    this.#dictionary = new Dictionary()

    let id = params.get(Game.Params.id) ?? Game.defaultId()
    const date = Date.parse(id)
    if (!isNaN(date) && date > Game.today) {
      console.debug(`Defaulting to current day puzzle given ID in the future: ${id}`)
      id = Game.defaultId()
    }

    this.#grid = new Grid(id, params.get(Game.Params.width))
    this.#state = new State({}, this.#grid.getSeed())

    $id.href = `?id=${id}`
    $id.textContent = id

    this.#eventListeners.add([
      { type: Cell.Events.Select, handler: this.#onCellSelect },
      { type: 'click', element: $reset, handler: this.reset },
      { type: 'pointerup', element: document, handler: this.#onPointerUp }
    ])

    this.update()
  }

  reset () {
    this.#grid.reset()

    this.#pointer = undefined
    this.#path = []

    this.update()
  }

  validate (cells) {
    // Accept words spelled backwards or forwards
    const words = [Game.getWord(cells), Game.getWord(Array.from(cells).reverse())]
    if (words.some((word) => this.#dictionary.isValid(word))) {
      this.#path.push(cells)
    } else {
      cells.forEach((cell) => cell.disconnect())
    }

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

  #onCellSelect (event) {
    const cell = event.detail.cell
    const index = this.#selection.findIndex((selected) => selected.equals(cell))
    if (index > -1) {
      // Going back to an already selected cell, remove everything selected after it
      const deselected = this.#selection.splice(index + 1)
      deselected.forEach((cell) => {
        return cell.update((state) =>
          state.copy({ flags: state.getFlags().remove(Cell.Flags.Selected) })
        )
      })
      this.#updateState(deselected)
      return
    }

    const last = this.#path[this.#path.length - 1] ?? this.#selection[this.#selection.length - 1]
    if (last && !last.isNeighbor(cell)) {
      // Can only select cells that are neighbors of the last cell
      return
    }

    this.#selection.push(cell)

    const flags = [Cell.Flags.Path, Cell.Flags.Selected]
    if (last) {
      flags.push(Cell.directionToFlag(cell.getCoordinates().getDirection(last.getCoordinates())))
    }

    // Note: Selection updates are not stored in state
    cell.update((state) => {
      return state.copy({ flags: state.getFlags().add(...flags) })
    })
  }

  #onPointerUp (event) {
    console.log('onPointerUp', event)
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

  static getWord (cells) {
    return cells.map((cell) => cell.getContent()).join('')
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
