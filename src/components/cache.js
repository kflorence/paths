import { base64decode, base64encode } from './util'

export class Cache {
  encoding
  getter
  key
  setter

  constructor (key, getter, setter, encoding = []) {
    this.key = key
    this.getter = getter
    this.setter = setter
    this.encoding = encoding
  }

  decode (value) {
    if (value === null || value === undefined) {
      return
    }

    if (this.encoding.includes(Cache.Encoders.Base64)) {
      value = base64decode(value)
    }

    if (this.encoding.includes(Cache.Encoders.Json)) {
      value = JSON.parse(value)
    }

    return value
  }

  encode (value) {
    if (value === null || value === undefined) {
      return
    }

    if (this.encoding.includes(Cache.Encoders.Json)) {
      value = JSON.stringify(value)
    }

    if (this.encoding.includes(Cache.Encoders.Base64)) {
      value = base64encode(value)
    }

    return value
  }

  get () {
    return this.decode(this.getter(this.key))
  }

  set (value) {
    return this.setter(this.key, this.encode(value))
  }

  static Encoders = Object.freeze({
    Base64: 'base64',
    Json: 'json'
  })
}
