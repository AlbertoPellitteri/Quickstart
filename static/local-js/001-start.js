/* global bootstrap, $ */

// Event listener for clearing session data
document.addEventListener('DOMContentLoaded', function () {
  const clearSessionButton = document.getElementById('clearSessionButton')
  const configNameInput = document.getElementById('config_name')

  // Get references to modal and elements
  const modal = new bootstrap.Modal(document.getElementById('confirmationModal'))
  const modalBody = document.getElementById('confirmationModalBody')
  const modalConfirmButton = document.getElementById('confirmClearSession')

  if (clearSessionButton) {
    clearSessionButton.addEventListener('click', function (event) {
      event.preventDefault()
      const configName = configNameInput.value.trim()

      // Update modal message dynamically
      modalBody.textContent = `Are you sure you want to reset the configuration for "${configName}"? This action will delete any saved data for "${configName}" and cannot be undone.`
      modal.show()

      // Add confirm action to the modal button
      modalConfirmButton.onclick = function () {
        $.post('/clear_session', { name: configName }, function (data) {
          // Handle success or failure (if necessary)
          console.log('Config cleared for:', configName)
        }).fail(function (error) {
          console.error('Error clearing config:', error)
        })

        // Hide modal after submission
        modal.hide()
      }
    })
  }
})

/* eslint-disable no-unused-vars, camelcase */
function validate_name (select) {
  let text = select.value

  text = text.toLowerCase()
  text = text.replace(/[^a-z0-9_]/g, '')

  select.value = text
}
/* eslint-enable no-unused-vars, camelcase */
