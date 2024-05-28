import { base64decode, base64encode, localStorage, urlParams } from './util'

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

  copy (settings) {
    return new Cache(
      settings.key ?? this.key,
      settings.getter ?? this.getter,
      settings.setter ?? this.setter,
      settings.encoding ?? this.encoding
    )
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

  static localStorage (key, encoding) {
    return new Cache(key, localStorage.getItem.bind(localStorage), localStorage.setItem.bind(localStorage), encoding)
  }

  static urlParams (key, encoding) {
    return new Cache(key, urlParams.get.bind(urlParams), urlParams.set.bind(urlParams), encoding)
  }

  static Encoders = Object.freeze({
    Base64: 'base64',
    Json: 'json'
  })
}
