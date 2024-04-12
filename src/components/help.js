const $help = document.getElementById('help')
const $helpDialog = document.getElementById('help-dialog')

$help.addEventListener('click', () => {
  if (!$helpDialog.open) {
    $helpDialog.showModal()
  }
})
