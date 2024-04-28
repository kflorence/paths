import { State } from './state'

const console = window.console = window.console || { debug: function () {} }
const consoleDebug = console.debug

export function debug (debug) {
  console.debug = debug ? consoleDebug : function () {}
}

// Silence debug logging by default
debug(State.params.has(State.Params.Debug) ?? false)
