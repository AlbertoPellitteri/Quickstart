/* global $, showSpinner, hideSpinner */

$(document).ready(function () {
  const tokenInput = document.getElementById('ntfy_token')
  const toggleButton = document.getElementById('toggleTokenVisibility')
  const isValidated = document.getElementById('ntfy_validated').value.toLowerCase()
  const validateButton = document.getElementById('validateButton')

  console.log('Validated: ' + isValidated)

  // Set initial visibility based on API key value
  if (tokenInput.value.trim() === '') {
    tokenInput.setAttribute('type', 'text') // Show placeholder text
    toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>' // Set eye-slash icon
  } else {
    tokenInput.setAttribute('type', 'password') // Hide actual key
    toggleButton.innerHTML = '<i class="fas fa-eye"></i>' // Set eye icon
  }

  if (isValidated === 'true') {
    validateButton.disabled = true
  } else {
    validateButton.disabled = false
  }

  tokenInput.addEventListener('input', function () {
    document.getElementById('ntfy_validated').value = 'false'
    validateButton.disabled = false
  })

  document.getElementById('ntfy_url').addEventListener('input', function () {
    document.getElementById('ntfy_validated').value = 'false'
    validateButton.disabled = false
  })

  document.getElementById('ntfy_topic').addEventListener('input', function () {
    document.getElementById('ntfy_validated').value = 'false'
    validateButton.disabled = false
  })
})

// Function to toggle API key visibility
document.getElementById('toggleTokenVisibility').addEventListener('click', function () {
  const tokenInput = document.getElementById('ntfy_token')
  const currentType = tokenInput.getAttribute('type')
  tokenInput.setAttribute('type', currentType === 'password' ? 'text' : 'password')
  this.innerHTML = currentType === 'password' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'
})

/* eslint-disable camelcase */
// Event listener for the validate button
document.getElementById('validateButton').addEventListener('click', function () {
  const ntfy_url = document.getElementById('ntfy_url').value
  const ntfy_token = document.getElementById('ntfy_token').value
  const ntfy_topic = document.getElementById('ntfy_topic').value
  const statusMessage = document.getElementById('statusMessage')

  if (!ntfy_url || !ntfy_token || !ntfy_topic) {
    statusMessage.textContent = 'Please enter ntfy URL, Token and Topic.'
    statusMessage.style.color = '#ea868f'
    statusMessage.style.display = 'block'
    return
  }

  showSpinner('validate')

  fetch('/validate_ntfy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ntfy_url,
      ntfy_token,
      ntfy_topic
    })
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.valid) {
        hideSpinner('validate')
        document.getElementById('ntfy_validated').value = 'true'
        statusMessage.textContent = 'ntfy credentials validated successfully! Ensure you are subscribed to topic to see test message.'
        statusMessage.style.color = '#75b798'
      } else {
        hideSpinner('validate')
        document.getElementById('ntfy_validated').value = 'false'
        statusMessage.textContent = data.error
        statusMessage.style.color = '#ea868f'
      }
      document.getElementById('validateButton').disabled = data.valid
      statusMessage.style.display = 'block'
    })
    .catch((error) => {
      hideSpinner('validate')
      console.error('Error validating ntfy credentials:', error)
      statusMessage.textContent = 'An error occurred while validating ntfy credentials.'
      statusMessage.style.color = '#ea868f'
      statusMessage.style.display = 'block'
    })
})
/* eslint-enable camelcase */
