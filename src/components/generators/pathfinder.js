import { GridGenerator } from '../gridGenerator'
import { Cell } from '../cell'
import { randomIntInclusive } from '../util'

export class Pathfinder extends GridGenerator {
  #cells
  #characters
  #difficulty
  #invalidStepIndexes
  #steps = []
  #tries = 0
  #restartThreshold
  #wordBoundaries
  #wordBoundaryIndexes

  constructor (words, width, rand, difficulty) {
    super(words, width, rand)

    this.#cells = new Array(this.size)
    this.#difficulty = difficulty
    this.#restartThreshold = this.size * 2

    // TODO higher difficulty = more swaps
    // TODO hints, which can utilize the word boundaries

    let lastIndex = -1
    words.forEach((word, wordIndex) => {
      lastIndex += word.length
      this.#wordBoundaries[lastIndex] = wordIndex
    })

    this.#wordBoundaryIndexes = Object.keys(this.#wordBoundaries)
      .map(Number)
      .sort((a, b) => a - b)

    this.#characters = words.reduce(
      (acc, word) => acc.concat(word.split('')),
      []
    )
  }

  generate () {
    while (this.#steps.length < this.size) {
      this.#step()
    }

    return this.#cells
  }

  #getAvailableCellIndexes () {
    // Return an array of all indexes that don't contain a value
    return [...this.#cells].flatMap((v, i) => (v === undefined ? [i] : []))
  }

  #getConnectableIndexes (pool) {
    const connectable = []
    const queue = []
    const visited = {}

    function dequeue () {
      const index = queue.pop()

      connectable.push(index)

      // Remove this index from the pool
      pool.splice(pool.indexOf(index), 1)

      return index
    }

    function enqueue (index) {
      visited[index] = true
      queue.push(index)
    }

    // Start processing from the end
    enqueue(pool[pool.length - 1])

    while (queue.length > 0) {
      const index = dequeue()
      const coordinates = this.getCoordinates(index)
      const validIndexes = pool.filter((index) => !visited[index])

      // Enqueue all valid neighbors
      this.#getNeighbors(coordinates, validIndexes).forEach((neighbor) => enqueue(this.getIndex(neighbor.coordinates)))
    }

    return connectable.sort((a, b) => a - b)
  }

  #getConnectableGroups (indexes) {
    const groups = []
    const pool = Array.from(indexes)

    while (pool.length > 0) {
      groups.push(this.#getConnectableIndexes(pool))
    }

    return groups
  }

  #getNeighbors (coordinates, validIndexes) {
    return coordinates.neighbors.filter((neighbor) => {
      if (!this.isValid(neighbor.coordinates)) {
        return false
      }

      if (validIndexes && !validIndexes.includes(neighbor.index)) {
        return false
      }

      if (neighbor.isDirectionDiagonal) {
        const [source, target] = neighbor.coordinates
          .getNeighborsCrossing(coordinates)
          .map((neighbor) => this.#steps[neighbor.index])
        if (source?.isConnected(target)) {
          // Eliminate neighbors that cannot be reached due to crossing paths
          return false
        }
      }

      return true
    })
  }

  #getWordIndex (characterIndex) {
    return this.#wordBoundaries[
      this.#wordBoundaryIndexes.find((index) => index >= characterIndex)
    ]
  }

  #step () {
    this.#tries++
    console.debug(`Picking next index. Total tries: ${this.#tries}`)

    if (this.#tries % this.#restartThreshold === 0) {
      // Sometimes a random path causes too many choices. To speed things up, restart every X number of tries.
      console.debug('Exhausted tries on current path. Starting over.')
      this.#restart()
    }

    const availableCellIndexes = this.#getAvailableCellIndexes()
    const stepIndex = this.#steps.length - 1

    const lastStep = this.#steps[stepIndex]
    if (!lastStep) {
      // First step
      const index = randomIntInclusive(this.rand, availableCellIndexes.length - 1)
      this.#addStep(availableCellIndexes[index])
      return
    }

    // Filter out any steps we have already determined are invalid
    const invalidStepIndexes = this.#invalidStepIndexes[lastStep.key] ??= {}
    const validStepIndexes = invalidStepIndexes
      ? availableCellIndexes.filter((index) => !invalidStepIndexes[index])
      : availableCellIndexes

    const stepsRemaining = this.size - stepIndex
    console.debug(`stepsRemaining: ${stepsRemaining}`)

    const validNeighbors = this.#getNeighbors(lastStep.coordinates, validStepIndexes)
      .filter((neighbor) => {
        // Assess groupability of available indexes assuming this neighbor is picked, and so removed from availability.
        const groups = this.#getConnectableGroups(availableCellIndexes.filter((index) => index !== neighbor.index))
        if (groups.length > 1) {
          // Picking this neighbor would cause multiple groups.
          return false
        } else if (groups.length === 1 && groups[0].length < stepsRemaining) {
          // Picking this neighbor would result in a group that is too small for the number of remaining steps.
          return false
        }

        return true
      })

    if (!validNeighbors.length) {
      // No valid steps from here. Remove the last step and try again.
      this.#removeLastStep()
    }

    // Pick a random neighbor from the list of valid neighbors to step to
    const index = randomIntInclusive(this.rand, validNeighbors.length - 1)
    this.#addStep(this.getIndex(validNeighbors[index].coordinates))
  }

  #addStep (index, lastStep) {
    const coordinates = this.getCoordinates(index)
    const character = this.#characters[this.#steps.length]
    const cell = new Cell(coordinates, new Cell.State(index, character))

    this.#cells[index] = cell
    this.#steps.push(new Step(cell, lastStep))
  }

  #removeLastStep () {
    const lastStep = this.path.pop()
    const index = lastStep.index

    delete this.cells[index]

    // Mark this choice as invalid so we don't try it again
    this.#invalidStepIndexes[lastStep.key][index] = true
  }

  #restart () {
    while (this.#steps.length > 0) {
      this.#removeLastStep()
    }

    for (const key in this.#invalidStepIndexes) {
      this.#invalidStepIndexes[key] = {}
    }
  }
}

class Step {
  cell
  coordinates
  index
  key
  parent

  constructor (cell, parent) {
    this.cell = cell
    this.coordinates = cell.getCoordinates()
    this.index = cell.getIndex()
    this.key = [parent.key, this.index].join(',')
    this.parent = parent
  }

  equals (other) {
    return this.index === other?.index
  }

  isConnected (other) {
    return (this.parent?.equals(other) || other?.parent?.equals(this)) === true
  }
}
