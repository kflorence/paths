import { getIndexesUnique, randomIntInclusive, reverseString, splitmix32 } from './util'
import { Grid } from './grid'
import { Cell } from './cell'

export class Generator {
  characters
  configuration
  dictionary
  rand
  wordBoundaries
  words

  #invalidSteps = {}
  #maxTries
  #path = []
  #steps
  #tries = 0
  #restartThreshold

  constructor (configuration, dictionary) {
    this.rand = splitmix32(configuration.hash)
    this.words = dictionary.getWords(
      this.rand,
      configuration.size,
      Math.ceil(configuration.width + (configuration.width / 2))
    )

    const words = Array.from(this.words)
    const characters = words.reduce((characters, word) => characters.concat(word.split('')), [])

    if (configuration.mode === Grid.Modes.Challenge) {
      // Randomly reverse up to half of the words
      const reverseCount = randomIntInclusive(this.rand, Math.floor(words.length / 2))
      console.debug(`Reversing ${reverseCount} words.`)
      getIndexesUnique(this.rand, words, reverseCount)
        .forEach((index) => { words[index] = reverseString(words[index]) })
    }

    this.characters = characters
    this.configuration = configuration
    this.dictionary = dictionary
    this.wordBoundaries = Generator.getWordBoundaries(this.words)

    this.#steps = new Array(configuration.size)
    this.#restartThreshold = configuration.size * configuration.width
    this.#maxTries = this.#restartThreshold * configuration.size
  }

  /**
   * Generate grid state configuration.
   * @returns {Grid.State.Configuration}
   */
  generate () {
    while (this.#path.length < this.configuration.size) {
      this.#step()
    }

    const cells = this.#steps.map((step) => step.state)
    const path = this.#path.map((step) => step.index)
    const wordIndexes = this.wordBoundaries.map((boundary) => boundary.map((index) => path[index]))

    console.debug('Done.', path)

    return new Grid.State.Configuration(cells, path, this.words, wordIndexes)
  }

  #getAvailableCellIndexes () {
    // Return an array of all indexes that don't contain a value
    return [...this.#steps].flatMap((v, i) => (v === undefined ? [i] : []))
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
      const coordinates = this.configuration.getCoordinates(index)
      const validIndexes = pool.filter((index) => !visited[index])
      if (validIndexes.length) {
        // Enqueue all valid neighbors
        this.#getNeighbors(coordinates, validIndexes)
          .forEach((neighbor) => enqueue(this.configuration.getIndex(neighbor.coordinates)))
      }
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
    if (!validIndexes.length) {
      return []
    }

    return coordinates.getNeighbors().filter((neighbor) => {
      if (!this.configuration.isValid(neighbor.coordinates)) {
        return false
      }

      const index = this.configuration.getIndex(neighbor.coordinates)
      if (validIndexes && !validIndexes.includes(index)) {
        return false
      }

      if (neighbor.isDirectionDiagonal) {
        // console.log('neighbor is directional', neighbor)
        const [source, target] = neighbor.coordinates
          .getNeighborsCrossing(coordinates)
          .map((neighbor) => {
            const index = this.configuration.getIndex(neighbor.coordinates)
            return this.#steps[index]
          })
        // console.log(source, target, source?.isConnected(target))
        if (source?.isConnected(target)) {
          // Eliminate neighbors that cannot be reached due to crossing paths
          return false
        }
      }

      return true
    })
  }

  #step () {
    this.#tries++

    const steps = this.#path.length
    const stepsRemaining = this.configuration.size - steps

    console.debug(`Steps remaining: ${stepsRemaining}. Total tries: ${this.#tries}`)

    if (this.#tries > this.#maxTries) {
      // Shouldn't happen, but break the loop if it gets stuck for some reason.
      throw new Error(`Too many tries: ${this.#tries}. Stopping.`)
    } else if (this.#tries % this.#restartThreshold === 0) {
      // Sometimes a random path causes too many choices. To speed things up, restart every X number of tries.
      console.debug('Exhausted tries on current path. Starting over.')
      this.#restart()
    }

    const availableCellIndexes = this.#getAvailableCellIndexes()
    const lastStep = this.#path[steps - 1]

    if (!lastStep) {
      // First step
      const index = randomIntInclusive(this.rand, availableCellIndexes.length - 1)
      this.#addStep(availableCellIndexes[index])
      return
    }

    // Filter out any steps we have already determined to be invalid from this point.
    const validStepIndexes = availableCellIndexes.filter((index) => !this.#invalidSteps[Step.key(lastStep.key, index)])

    // The minimum group size after picking the next step
    const minGroupSize = stepsRemaining - 1
    const validNeighbors = this.#getNeighbors(lastStep.coordinates, validStepIndexes)
      .filter((neighbor) => {
        const index = this.configuration.getIndex(neighbor.coordinates)
        // Assess groupability of available indexes assuming this neighbor is picked, and so removed from availability.
        const groupableIndexes = availableCellIndexes.filter((available) => available !== index)
        const groups = this.#getConnectableGroups(groupableIndexes)

        console.debug('Found groups', groups, 'for neighbor', neighbor, 'with available indexes', groupableIndexes)

        if (groups.length > 1) {
          console.debug('Excluding neighbor: multiple groups', neighbor)
          return false
        } else if (groups.length === 1 && groups[0].length < minGroupSize) {
          // Picking this neighbor would result in a group that is too small for the number of remaining steps.
          console.debug('Excluding neighbor: group is too small', neighbor)
          return false
        }

        return true
      })

    if (!validNeighbors.length) {
      console.debug('No valid steps from here. Removing last step and trying again.')
      return this.#removeLastStep()
    }

    // Pick a random neighbor from the list of valid neighbors to step to
    const index = randomIntInclusive(this.rand, validNeighbors.length - 1)
    this.#addStep(this.configuration.getIndex(validNeighbors[index].coordinates), lastStep)
  }

  #addStep (index, lastStep) {
    const coordinates = this.configuration.getCoordinates(index)
    const character = this.characters[this.#path.length]
    const step = new Step(new Cell.State(index, character), coordinates, lastStep)

    this.#steps[index] = step
    this.#path.push(step)

    console.debug('Added step:', step)
  }

  #removeLastStep () {
    const step = this.#path.pop()
    const index = step.index

    delete this.#steps[index]

    // Mark this choice as invalid so we don't try it again
    this.#invalidSteps[step.key] = true

    console.debug('Removed step:', step)
  }

  #restart () {
    while (this.#path.length > 0) {
      this.#removeLastStep()
    }

    for (const key in this.#invalidSteps) {
      this.#invalidSteps[key] = {}
    }
  }

  static getWordBoundaries (words) {
    return words.reduce((boundaries, word) => {
      const last = boundaries[boundaries.length - 1]
      const lastIndex = last ? last[last.length - 1] + 1 : 0
      boundaries.push([...word.split('').map((_, index) => lastIndex + index)])
      return boundaries
    }, [])
  }
}

class Step {
  coordinates
  index
  key
  parent
  state

  constructor (state, coordinates, parent) {
    this.coordinates = coordinates
    this.index = state.index
    this.key = parent ? Step.key(parent.key, this.index) : this.index.toString()
    this.parent = parent
    this.state = state
  }

  equals (other) {
    return this.index === other?.index
  }

  isConnected (other) {
    return (this.parent?.equals(other) || other?.parent?.equals(this)) === true
  }

  static key (...parts) {
    return parts.join('.')
  }
}
