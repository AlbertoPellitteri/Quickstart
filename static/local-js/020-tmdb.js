/* global $, showSpinner, hideSpinner */

document.addEventListener('DOMContentLoaded', function () {
  const validateButton = document.getElementById('validateButton')
  const tmdbValidatedInput = document.getElementById('tmdb_validated')
  const regionDropdown = document.getElementById('tmdb_region')
  const languageDropdown = document.getElementById('tmdb_language')
  const regionStatusMessage = document.getElementById('regionStatusMessage')
  const languageStatusMessage = document.getElementById('languageStatusMessage')
  const statusMessage = document.getElementById('statusMessage')
  const apiKeyInput = document.getElementById('tmdb_apikey')
  const isValidated = document.getElementById('tmdb_validated').value.toLowerCase()

  console.log('Validated: ' + isValidated)

  if (isValidated === 'true') {
    validateButton.disabled = true
  } else {
    validateButton.disabled = false
  }

  // Function to validate a dropdown and show a message
  function validateDropdown (dropdown, statusMessage, fieldName) {
    if (!dropdown.value) {
      statusMessage.textContent = `${fieldName} is required.`
      statusMessage.style.color = '#ea868f' // Red for error
      statusMessage.style.display = 'block'
      return false
    } else {
      statusMessage.textContent = `${fieldName} is valid!`
      statusMessage.style.color = '#75b798' // Green for success
      statusMessage.style.display = 'block'
      return true
    }
  }

  // Function to check overall validation state and update navigation buttons
  function updateNavigationState () {
    const isApiValidated = tmdbValidatedInput && tmdbValidatedInput.value.toLowerCase() === 'true'
    const isRegionValid = validateDropdown(regionDropdown, regionStatusMessage, 'Region')
    const isLanguageValid = validateDropdown(languageDropdown, languageStatusMessage, 'Language')

    const isFormValid = isApiValidated && isRegionValid && isLanguageValid

    // Update tmdb_validated value
    tmdbValidatedInput.value = isFormValid ? 'true' : 'false'

    // Enable or disable navigation buttons
    $('#configForm button[onclick*="next"]').prop('disabled', !isFormValid)
    $('.dropdown-toggle').prop('disabled', !isFormValid)
  }

  // Initial validation on page load
  function handleInitialValidation () {
    const isApiPreviouslyValidated = tmdbValidatedInput && tmdbValidatedInput.value.toLowerCase() === 'true'

    // Display API validation status if previously validated
    if (isApiPreviouslyValidated) {
      statusMessage.textContent = 'API key is valid!'
      statusMessage.style.color = '#75b798' // Green for success
      statusMessage.style.display = 'block'
    }

    // Validate region and language dropdowns
    validateDropdown(regionDropdown, regionStatusMessage, 'Region')
    validateDropdown(languageDropdown, languageStatusMessage, 'Language')

    // Update navigation state based on the current validation
    updateNavigationState()
  }

  // Call the validation check initially
  handleInitialValidation()

  // Validate TMDb API key
  validateButton.addEventListener('click', function () {
    const apiKey = apiKeyInput.value.trim()

    if (!apiKey) {
      statusMessage.textContent = 'API key cannot be empty.'
      statusMessage.style.color = '#ea868f'
      statusMessage.style.display = 'block'
      return
    }

    // Show spinner and disable validate button while validating
    showSpinner('validate')
    validateButton.disabled = true

    fetch('/validate_tmdb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tmdb_apikey: apiKey })
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.valid) {
          tmdbValidatedInput.value = 'true' // Mark as validated
          statusMessage.textContent = 'API key is valid!'
          statusMessage.style.color = '#75b798' // Green for success
          validateButton.disabled = true // Disable validate button after success
        } else {
          tmdbValidatedInput.value = 'false' // Mark as not validated
          statusMessage.textContent = 'Failed to validate TMDb. Please check your API Key.'
          statusMessage.style.color = '#ea868f' // Red for error
        }
      })
      .catch((error) => {
        console.error('Error validating TMDb server:', error)
        statusMessage.textContent = 'An error occurred. Please try again.'
        statusMessage.style.color = '#ea868f' // Red for error
      })
      .finally(() => {
        hideSpinner('validate')
        statusMessage.style.display = 'block'
        updateNavigationState() // Recheck navigation state after validation
      })
  })

  // Event listeners for dropdown changes
  regionDropdown.addEventListener('change', updateNavigationState)
  languageDropdown.addEventListener('change', updateNavigationState)

  // Reset validation when the API key changes
  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', function () {
      tmdbValidatedInput.value = 'false' // Reset validation
      validateButton.disabled = false // Allow re-validation
      updateNavigationState() // Recheck navigation state
    })
  }

  // Toggle API key visibility
  document
    .getElementById('toggleApikeyVisibility')
    .addEventListener('click', function () {
      const currentType = apiKeyInput.getAttribute('type')
      apiKeyInput.setAttribute('type', currentType === 'password' ? 'text' : 'password')
      this.innerHTML =
        currentType === 'password'
          ? '<i class="fas fa-eye-slash"></i>'
          : '<i class="fas fa-eye"></i>'
    })
})
