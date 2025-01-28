/* global bootstrap, $ */

// Event listener for clearing session data
document.addEventListener('DOMContentLoaded', function () {
  const clearSessionButton = document.getElementById('clearSessionButton')
  const configNameInput = document.getElementById('config_name')

  // Get references to modal and its elements
  const modal = new bootstrap.Modal(document.getElementById('confirmationModal'))
  const modalBody = document.getElementById('confirmationModalBody')
  const modalConfirmButton = document.getElementById('confirmClearSession')

  // Get references to toast elements
  const successToastElement = document.getElementById('successToast')
  const errorToastElement = document.getElementById('errorToast')

  if (clearSessionButton) {
    clearSessionButton.addEventListener('click', function (event) {
      event.preventDefault()
      const configName = configNameInput.value.trim()

      // Update modal message dynamically
      modalBody.textContent = `Are you sure you want to reset the configuration for "${configName}"? This action will delete any saved data for "${configName}" and cannot be undone.`
      modal.show()

      // Add confirm action to the modal button
      modalConfirmButton.onclick = function () {
        const configName = configNameInput.value.trim()

        if (!configName) {
          // Show error toast for missing config name
          const errorToastBody = errorToastElement.querySelector('.toast-body')
          errorToastBody.textContent = 'Config name is required.'
          const errorToast = new bootstrap.Toast(errorToastElement)
          errorToast.show()
          return // Exit if no config name is provided
        }

        // Send AJAX POST request to clear the session
        $.post('/clear_session', { name: configName }, function (response) {
          if (response.status === 'success') {
            // Show success toast
            const successToastBody = successToastElement.querySelector('.toast-body')
            successToastBody.textContent = response.message
            const successToast = new bootstrap.Toast(successToastElement)
            successToast.show()

            // Hide the modal
            modal.hide()
          } else {
            // Show error toast for an unexpected server response
            const errorToastBody = errorToastElement.querySelector('.toast-body')
            errorToastBody.textContent = response.message || 'An unexpected error occurred.'
            const errorToast = new bootstrap.Toast(errorToastElement)
            errorToast.show()
          }
        }).fail(function (error) {
          // Show error toast for failed request
          const errorMessage = error.responseJSON?.message || 'An unknown error occurred.'
          const errorToastBody = errorToastElement.querySelector('.toast-body')
          errorToastBody.textContent = errorMessage
          const errorToast = new bootstrap.Toast(errorToastElement)
          errorToast.show()
        })

        // Hide modal after the action (optional, could move to success block)
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
