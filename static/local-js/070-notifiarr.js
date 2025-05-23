/* global $, validateButton, showSpinner, hideSpinner */

$(document).ready(function () {
  const apiKeyInput = document.getElementById('notifiarr_apikey')
  const validateButton = document.getElementById('validateButton')
  const toggleButton = document.getElementById('toggleApikeyVisibility')
  const isValidated = document.getElementById('notifiarr_validated').value.toLowerCase()

  console.log('Validated: ' + isValidated)

  // Set initial visibility based on API key value
  if (apiKeyInput.value.trim() === '') {
    apiKeyInput.setAttribute('type', 'text') // Show placeholder text
    toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>' // Set eye icon
  } else {
    apiKeyInput.setAttribute('type', 'password') // Hide actual key
    toggleButton.innerHTML = '<i class="fas fa-eye"></i>' // Set eye-slash icon
  }

  // Disable validate button if already validated
  validateButton.disabled = isValidated === 'true'

  // Reset validation status when user types
  apiKeyInput.addEventListener('input', function () {
    document.getElementById('notifiarr_validated').value = 'false'
    validateButton.disabled = false
  })
})

async function validateNotifiarrApikey (apikey) {
  showSpinner('validate')
  const apiUrl = '/validate_notifiarr'
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ notifiarr_apikey: apikey })
  })

  if (response.ok) {
    hideSpinner('validate')
    const data = await response.json()
    return data.valid
  } else {
    hideSpinner('validate')
    const errorData = await response.json()
    console.error('Error validating Notifiarr apikey:', errorData.message)
    return false
  }
}

document.getElementById('validateButton').addEventListener('click', function () {
  const apiKey = document.getElementById('notifiarr_apikey').value
  const statusMessage = document.getElementById('statusMessage')

  if (!apiKey) {
    statusMessage.textContent = 'Please enter a Notifiarr API key.'
    statusMessage.style.color = '#ea868f'
    statusMessage.style.display = 'block'
    return
  }

  validateButton.disabled = true

  validateNotifiarrApikey(apiKey).then(isValid => {
    if (isValid) {
      document.getElementById('notifiarr_validated').value = 'true'
      statusMessage.textContent = 'Notifiarr API key is valid.'
      statusMessage.style.color = '#75b798'
      validateButton.disabled = true
    } else {
      document.getElementById('notifiarr_validated').value = 'false'
      statusMessage.textContent = 'Notifiarr API key is invalid.'
      statusMessage.style.color = '#ea868f'
      validateButton.disabled = false
    }
    statusMessage.style.display = 'block'
  })
})

document.getElementById('toggleApikeyVisibility').addEventListener('click', function () {
  const apikeyInput = document.getElementById('notifiarr_apikey')
  const currentType = apikeyInput.getAttribute('type')
  apikeyInput.setAttribute('type', currentType === 'password' ? 'text' : 'password')
  this.innerHTML = currentType === 'password' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'
})

document.getElementById('configForm').addEventListener('submit', function (event) {
  const apiKeyInput = document.getElementById('notifiarr_apikey')
  if (!apiKeyInput.value) {
    apiKeyInput.value = ''
  }
})
