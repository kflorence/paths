export function getClassName(...parts) {
  return parts.join('-')
}

export function getSelector(className) {
  return `.${className}`
}
