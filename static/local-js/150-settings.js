/* global */

document.addEventListener('DOMContentLoaded', function () {
  const configForm = document.getElementById('configForm')
  const validationMessages = document.getElementById('validation-messages')

  function setSettingsValidated (isValid) {
    const settingsValidatedInput = document.getElementById('settings_validated')
    settingsValidatedInput.value = isValid ? 'true' : 'false'
  }

  function showAccordionForField (field) {
    const accordionItem = field.closest('.accordion-collapse')
    if (accordionItem && !accordionItem.classList.contains('show')) {
      const accordionHeader = accordionItem.previousElementSibling.querySelector('button.accordion-button')
      if (accordionHeader) {
        accordionHeader.click() // Simulate a click to open the accordion
      }
    }
  }

  function validateField (field, regex, errorMessage) {
    const value = field.value.trim()
    const errorDivClass = 'error-message'
    const successClass = 'is-valid'

    // Locate or create the error message element
    let errorDiv = field.parentNode.querySelector(`.${errorDivClass}`)
    if (!errorDiv) {
      errorDiv = document.createElement('div')
      errorDiv.className = `${errorDivClass} text-danger`
      field.parentNode.appendChild(errorDiv)
    }

    if (!regex.test(value)) {
      // Invalid: Show error message
      field.classList.add('is-invalid')
      field.classList.remove(successClass) // Remove success indicator
      errorDiv.textContent = errorMessage
      showAccordionForField(field) // Open accordion containing the invalid field
      return false
    } else {
      // Valid: Clear error message and add success indicator
      field.classList.remove('is-invalid')
      field.classList.add(successClass)
      errorDiv.textContent = '' // Clear error message
      return true
    }
  }

  const fieldsToValidate = [
    {
      id: 'asset_directory',
      regex: /^(?:[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*|\\{2}[^\\/:*?"<>|\r\n]+(?:\\[^\\/:*?"<>|\r\n]+)*|(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+|\/(?:[^/]+\/)*[^/]*|\.{1,2}(?:\/[^/]*)*|(?:[^/]+\/)*[^/]*)$/,
      errorMessage: 'Please enter a valid asset directory path.'
    },
    {
      id: 'ignore_ids',
      regex: /^(None|\d{1,8}(,\d{1,8})*)$/,
      errorMessage: 'Please enter a valid CSV list of numeric IDs (1-8 digits) or "None".'
    },
    {
      id: 'ignore_imdb_ids',
      regex: /^(None|tt\d{7,8}(,tt\d{7,8})*)$/,
      errorMessage: 'Please enter a valid CSV list of IMDb IDs (e.g., tt1234567) or "None".'
    },
    {
      id: 'custom_repo',
      regex: /^(None|https?:\/\/[\da-z.-]+\.[a-z.]{2,6}([/\w.-]*)*\/?)$/,
      errorMessage: 'Please enter a valid URL or "None".'
    }
  ]

  function updateValidationMessages (isValid) {
    if (isValid) {
      validationMessages.style.display = 'block'
      validationMessages.classList.remove('alert-danger')
      validationMessages.classList.add('alert-success')
      validationMessages.textContent = 'All fields are valid!'
    } else {
      validationMessages.style.display = 'block'
      validationMessages.classList.remove('alert-success')
      validationMessages.classList.add('alert-danger')
      validationMessages.textContent = 'Please fix the highlighted errors before submitting.'
    }
  }

  function validateForm () {
    let isFormValid = true

    fieldsToValidate.forEach(({ id, regex, errorMessage }) => {
      const field = document.getElementById(id)
      if (field) {
        const isValid = validateField(field, regex, errorMessage)
        if (!isValid) {
          isFormValid = false
        }
      }
    })

    updateValidationMessages(isFormValid)
    return isFormValid
  }

  document.querySelectorAll('input, select, textarea').forEach((element) => {
    const fieldToValidate = fieldsToValidate.find((field) => field.id === element.id)
    if (fieldToValidate) {
      // Add real-time validation
      element.addEventListener('input', function () {
        const isValid = validateField(this, fieldToValidate.regex, fieldToValidate.errorMessage)
        updateValidationMessages(isValid && validateForm())
      })
    }
  })

  // Validate form before submission
  configForm.addEventListener('submit', function (event) {
    if (!validateForm()) {
      event.preventDefault() // Prevent form submission if validation fails
      setSettingsValidated(false)
    } else {
      setSettingsValidated(true)
    }
  })

  // Validate form before navigation (Next, Previous, JumpTo)
  document.querySelectorAll('.next-button, .previous-button, .jump-to-button').forEach((button) => {
    button.addEventListener('click', function (event) {
      if (!validateForm()) {
        event.preventDefault() // Prevent navigation
        setSettingsValidated(false)
      } else {
        setSettingsValidated(true)
      }
    })
  })
})
