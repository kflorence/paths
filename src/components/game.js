import { Grid } from './grid'
import { Cell } from './cell'
import { Dictionary } from './dictionary'
import { EventListeners } from './eventListeners'
import { State } from './state'

const $footer = document.getElementById('footer')
const $id = document.getElementById('id')
const $reset = document.getElementById('reset')
const $score = document.getElementById('score')
const $words = document.getElementById('words')

const location = window.location
const params = new URLSearchParams(location.search)

export class Game {
  #dictionary
  #eventListeners = new EventListeners({ context: this })
  #grid
  #pointer
  #selected = []
  #state

  constructor () {
    this.#dictionary = new Dictionary()

    let id = params.get(Game.Params.id) ?? Game.defaultId()
    const date = Date.parse(id)
    if (!isNaN(date) && date > Game.today) {
      console.debug(`Defaulting to current day puzzle given ID in the future: ${id}`)
      id = Game.defaultId()
    }

    const width = params.get(Game.Params.width)
    const configuration = new Grid.Generator(id, width)

    this.#state = new State(configuration.seed, configuration)
    this.#grid = new Grid(this, this.#state.get())

    $id.href = `?id=${id}`
    $id.textContent = id

    this.#eventListeners.add([
      // Listening on document to handle pointerup outside the grid area
      { context: this.#grid, handler: this.#grid.deselect, type: 'pointerup' },
      { element: $reset, handler: this.reset, type: 'click' }
    ])

    // Build the words list based on data stored in cell state
    this.#grid.cells.filter((cell) => cell.getSelected()).forEach((cell) => {
      const [rowIndex, columnIndex] = cell.getSelected().split(',')
      return ((this.#selected[rowIndex] ??= [])[columnIndex] = cell)
    })

    this.update()
  }

  getLastSelected () {
    const path = this.getPath()
    return path[path.length - 1]
  }

  getPath () {
    return this.#selected.flat()
  }

  getWords () {
    return Array.from(this.#selected.map(Game.getWord))
  }

  reset () {
    this.#grid.reset()

    this.#pointer = undefined
    this.#selected = []

    this.update()
  }

  select (cells) {
    // Accept words spelled backwards or forwards
    const words = [Game.getWord(cells), Game.getWord(Array.from(cells).reverse())]
    if (words.some((word) => this.#dictionary.isValid(word))) {
      this.#selected.push(cells)
    } else {
      cells.forEach((cell) => cell.deselect())
    }

    this.update()
  }

  update () {
    const pointer = this.getLastSelected()
    if (!this.#pointer?.equals(pointer)) {
      // Update the state of the cells in the DOM based on the words multidimensional array
      const lastRowIndex = this.#selected.length - 1
      this.#selected.forEach((cells, rowIndex) => {
        const lastColumnIndex = cells.length - 1
        cells.forEach((cell, columnIndex) => {
          const classNames = [Cell.ClassNames.Word]
          if (columnIndex < lastColumnIndex) {
            if (columnIndex === 0) {
              if (rowIndex === 0) {
                classNames.push(Cell.ClassNames.First)
              }
              classNames.push(Cell.ClassNames.WordStart)
            }
          } else {
            if (rowIndex === lastRowIndex) {
              classNames.push(Cell.ClassNames.Last)
            }
            classNames.push(Cell.ClassNames.WordEnd)
          }

          const nextCell = cells[columnIndex + 1] ?? this.#selected[rowIndex + 1]?.[0]
          if (nextCell) {
            classNames.push(cell.getDirection(nextCell))
          }

          cell.removeClassNamesExcept(Cell.ClassNames.Cell, Cell.ClassNames.Selected)
          cell.addClassNames(...classNames)
          cell.setSelected([rowIndex, columnIndex].join(','))
        })
      })

      this.#pointer = pointer
    }

    this.#updateScore()

    this.#state.set(Object.assign(this.#state.get(), { grid: this.#grid.getState() }))
  }

  #updateScore () {
    // Newest at top
    const words = this.getWords()
    $words.replaceChildren(...words.map((word) => {
      const $element = document.createElement('li')
      $element.textContent = word
      return $element
    }))
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
