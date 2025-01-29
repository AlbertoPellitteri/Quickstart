/* global bootstrap, $ */

// Event listener for clearing session data
document.addEventListener('DOMContentLoaded', function () {
  const clearSessionButton = document.getElementById('clearSessionButton')
  const configSelector = document.getElementById('configSelector') // Dropdown replacing config_name
  const newConfigInput = document.getElementById('newConfigName') // Input when "Add Config" is selected

  // Get references to modal and its elements
  const modal = new bootstrap.Modal(document.getElementById('confirmationModal'))
  const modalBody = document.getElementById('confirmationModalBody')
  const modalConfirmButton = document.getElementById('confirmClearSession')

  if (clearSessionButton) {
    clearSessionButton.addEventListener('click', function (event) {
      event.preventDefault()

      let configName = configSelector.value.trim()

      // If "Add Config" is selected, get the name from newConfigName input
      if (configName === 'add_config') {
        configName = newConfigInput.value.trim()
      }

      if (!configName) {
        showToast('error', 'Config name is required.')
        return
      }

      // Update modal message dynamically
      modalBody.textContent = `Are you sure you want to reset the configuration for "${configName}"? This action will delete any saved data for "${configName}" and cannot be undone.`
      modal.show()

      // Add confirm action to the modal button
      modalConfirmButton.onclick = function () {
        let configName = configSelector.value.trim()

        if (configName === 'add_config') {
          configName = newConfigInput.value.trim()
        }

        if (!configName) {
          showToast('error', 'Config name is required.')
          return
        }

        // Send AJAX POST request to clear the session
        $.post('/clear_session', { name: configName }, function (response) {
          if (response.status === 'success') {
            showToast('success', response.message)

            // Redirect to start page after a short delay
            setTimeout(() => {
              window.location.href = window.location.origin + window.location.pathname
            }, 1500)
          } else {
            showToast('error', response.message || 'An unexpected error occurred.')
          }
        }).fail(function (error) {
          const errorMessage = error.responseJSON?.message || 'An unknown error occurred.'
          showToast('error', errorMessage)
        })

        modal.hide()
      }
    })
  }
})

// Function to show toast messages
function showToast (type, message) {
  const toastElement = type === 'success' ? document.getElementById('successToast') : document.getElementById('errorToast')
  const toastBody = toastElement.querySelector('.toast-body')
  toastBody.textContent = message
  const toast = new bootstrap.Toast(toastElement)
  toast.show()
}

// Function to handle the "Add Config" dropdown logic
function toggleConfigInput (selectElement) {
  const newConfigInput = document.getElementById('newConfigInput')

  if (selectElement.value === 'add_config') {
    newConfigInput.style.display = 'block'
  } else {
    newConfigInput.style.display = 'none'
  }
}

// Ensure "Add Config" is visible if pre-selected on page load
document.addEventListener('DOMContentLoaded', function () {
  const configSelector = document.getElementById('configSelector')
  if (configSelector.value === 'add_config') {
    toggleConfigInput(configSelector)
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
