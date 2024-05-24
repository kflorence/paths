const $info = document.getElementById('info')
const $infoDialog = document.getElementById('info-dialog')

$info.addEventListener('click', () => {
  if (!$infoDialog.open) {
    $infoDialog.showModal()
  }
})
