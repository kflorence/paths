const id = 'G-44BJC1S0CM'
const script = document.createElement('script')
script.setAttribute('src', `https://www.googletagmanager.com/gtag/js?id=${id}`)
document.head.append(script)

const dataLayer = window.dataLayer = window.dataLayer || []
function gtag () { dataLayer.push(arguments) }
gtag('js', new Date())
gtag('config', id)
