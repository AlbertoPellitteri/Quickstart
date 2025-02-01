/* global showToast, bootstrap, $ */

// 🛠️ Ensure toggleConfigInput is globally available
// function toggleConfigInput (selectElement) {
//   const newConfigInputContainer = document.getElementById('newConfigInput')

//   if (selectElement.value === 'add_config') {
//     newConfigInputContainer.style.display = 'block'
//   } else {
//     newConfigInputContainer.style.display = 'none'

//     // 🛠️ Reset validation when hiding input
//     const newConfigInput = document.getElementById('newConfigName')
//     removeValidationMessages(newConfigInput)
//   }
// }

document.addEventListener('DOMContentLoaded', function () {
  const clearSessionButton = document.getElementById('clearSessionButton')
  const configSelector = document.getElementById('configSelector') // Dropdown
  const newConfigInput = document.getElementById('newConfigName') // Input for new config

  // Get references to modal and its elements
  const modal = new bootstrap.Modal(document.getElementById('confirmationModal'))
  const modalBody = document.getElementById('confirmationModalBody')
  const modalConfirmButton = document.getElementById('confirmClearSession')

  // ✅ **Regex-Based Input Validation (Forces Lowercase & Removes Invalid Characters)**
  if (newConfigInput) {
    newConfigInput.addEventListener('input', function () {
      let text = newConfigInput.value

      // ✅ Convert to lowercase & remove invalid characters (only a-z, 0-9, _ allowed)
      text = text.toLowerCase()
      text = text.replace(/[^a-z0-9_]/g, '')

      newConfigInput.value = text

      // ✅ **Check for duplicate name**
      checkDuplicateConfigName()
    })
  }

  // ✅ **Duplicate Name Check**
  function checkDuplicateConfigName () {
    const newConfigName = newConfigInput.value.trim().toLowerCase()
    let isDuplicate = false

    // Remove previous icons/messages
    removeValidationMessages(newConfigInput)

    // Loop through existing dropdown options
    for (const option of configSelector.options) {
      if (option.value.trim().toLowerCase() === newConfigName) {
        isDuplicate = true
        break
      }
    }

    if (isDuplicate) {
      showToast('error', `Config "${newConfigInput.value}" already exists!`)

      // 🔴 Apply **error** styles (Red border, error icon)
      applyValidationStyles(newConfigInput, 'error')
    } else if (newConfigName !== '') {
      // ✅ Apply **success** styles (Green border, checkmark icon)
      applyValidationStyles(newConfigInput, 'success')
    }
  }

  // ✅ **Event Listener for Clearing Session Data (WITH MODAL CONFIRMATION)**
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

      // **Show Confirmation Modal**
      modalBody.textContent = `Are you sure you want to reset the configuration for "${configName}"? This action will delete any saved data for "${configName}" and cannot be undone.`
      modal.show()

      // ✅ **Handle Modal Confirmation**
      modalConfirmButton.onclick = function () {
        let configName = configSelector.value.trim()

        if (configName === 'add_config') {
          configName = newConfigInput.value.trim()
        }

        if (!configName) {
          showToast('error', 'Config name is required.')
          return
        }

        // **Send AJAX POST Request to Clear the Session**
        $.post('/clear_session', { name: configName }, function (response) {
          if (response.status === 'success') {
            showToast('success', response.message)

            // Redirect to start page after a short delay
            setTimeout(() => {
              window.location.href = window.location.origin + window.location.pathname
            }, 4500)
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

// ✅ **Apply Validation Styles for Input Fields**
function applyValidationStyles (inputElement, type) {
  removeValidationMessages(inputElement)

  let iconHTML = ''

  if (type === 'error') {
    inputElement.classList.add('is-invalid')
    inputElement.style.border = '1px solid #dc3545' // 🔴 Red border
    iconHTML = '<div class="invalid-feedback"><i class="bi bi-exclamation-triangle-fill text-danger"></i> Name already exists. Pick from dropdown instead?</div>'
  } else if (type === 'success') {
    inputElement.classList.add('is-valid')
    inputElement.style.border = '1px solid #28a745' // ✅ Green border
    iconHTML = '<div class="valid-feedback"><i class="bi bi-check-circle-fill text-success"></i> Name is available</div>'
  }

  // **Insert feedback message**
  inputElement.insertAdjacentHTML('afterend', iconHTML)
}

// ✅ **Remove Validation Messages**
function removeValidationMessages (inputElement) {
  inputElement.classList.remove('is-invalid', 'is-valid')
  inputElement.style.border = ''
  const feedback = inputElement.parentElement.querySelector('.invalid-feedback, .valid-feedback')
  if (feedback) feedback.remove()
}
