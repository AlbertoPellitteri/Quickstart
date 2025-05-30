/* global $, showSpinner, hideSpinner */

$(document).ready(function () {
  const clientSecretInput = document.getElementById('mal_client_secret')
  const toggleButton = document.getElementById('toggleClientSecretVisibility')
  const validateButton = document.getElementById('validate_mal_url')
  const isValidatedElement = document.getElementById('mal_validated')
  const isValidated = isValidatedElement ? isValidatedElement.value.toLowerCase() : 'false'

  console.log('Validated:', isValidated)

  // Ensure initial visibility based on input value
  if (clientSecretInput.value.trim() === '') {
    clientSecretInput.setAttribute('type', 'text') // Show placeholder text
    toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>' // Show eye-slash
  } else {
    clientSecretInput.setAttribute('type', 'password') // Hide actual key
    toggleButton.innerHTML = '<i class="fas fa-eye"></i>' // Show eye
  }

  // Disable validate button if already validated
  if (isValidated === 'true') {
    validateButton.disabled = true
  }

  // Reset validation status when user types
  const inputFields = ['mal_client_id', 'mal_client_secret', 'mal_code_verifier', 'mal_localhost_url']
  inputFields.forEach(field => {
    const inputElement = document.getElementById(field)
    if (inputElement) {
      inputElement.addEventListener('input', function () {
        isValidatedElement.value = 'false'
        validateButton.disabled = false
      })
    } else {
      console.warn(`Warning: Element with ID '${field}' not found.`)
    }
  })
})

document.getElementById('toggleClientSecretVisibility').addEventListener('click', function () {
  const clientSecretInput = document.getElementById('mal_client_secret')
  const currentType = clientSecretInput.getAttribute('type')
  clientSecretInput.setAttribute('type', currentType === 'password' ? 'text' : 'password')
  this.innerHTML = currentType === 'password' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'
})

document.getElementById('mal_get_localhost_url').addEventListener('click', function () {
  const url = document.getElementById('mal_url').value
  if (url) {
    showSpinner('retrieve')
    window.open(url, '_blank').focus()
  }
})

/* eslint-disable no-unused-vars, camelcase */
function updateMALTargetURL () {
  const mal_client_id = document.getElementById('mal_client_id').value
  const code_verifier = document.getElementById('mal_code_verifier').value
  let myURL = ''
  if (mal_client_id.length === 32) {
    document.getElementById('mal_validated').value = 'false'
    myURL = 'https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=' + mal_client_id + '&code_challenge=' + code_verifier
  }
  console.log('updateMALTargetURL: ' + myURL)
  document.getElementById('mal_url').value = myURL
  enableLocalURLButton()
}

function openMALUrl () {
  const url = document.getElementById('mal_url').value
  if (url) {
    window.open(url, '_blank').focus()
  }
}

function checkURLField () {
  const localURL = document.getElementById('mal_localhost_url').value
  const localURLButton = document.getElementById('validate_mal_url')
  localURLButton.disabled = (localURL === '')
}
/* eslint-enable no-unused-vars, camelcase */

function enableLocalURLButton () {
  const url = document.getElementById('mal_url').value
  const urlButton = document.getElementById('mal_get_localhost_url')
  urlButton.disabled = url === ''
}

/* eslint-disable camelcase */
window.onload = function () {
  const mal_url_text = document.getElementById('mal_url')
  document.getElementById('validate_mal_url').disabled = true
  document.getElementById('validate_mal_url').disabled = true
  enableLocalURLButton(mal_url_text)
}

document.getElementById('validate_mal_url').addEventListener('click', function () {
  const malClient = document.getElementById('mal_client_id').value
  const malSecret = document.getElementById('mal_client_secret').value
  const malVerifier = document.getElementById('mal_code_verifier').value
  const malLocalhostURL = document.getElementById('mal_localhost_url').value
  const statusMessage = document.getElementById('statusMessage')

  if (!malClient || !malSecret || !malVerifier || !malLocalhostURL) {
    statusMessage.textContent = 'ID, secret, and localhost URL are all required.'
    statusMessage.style.display = 'block'
    return
  }

  showSpinner('validate')
  hideSpinner('retrieve')

  fetch('/validate_mal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mal_client_id: malClient,
      mal_client_secret: malSecret,
      mal_code_verifier: malVerifier,
      mal_localhost_url: malLocalhostURL
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.valid) {
        hideSpinner('validate')
        document.getElementById('mal_validated').value = 'true'
        statusMessage.textContent = 'MyAnimeList credentials validated successfully!'
        statusMessage.style.color = '#75b798'
        document.getElementById('access_token').value = data.mal_authorization_access_token
        document.getElementById('token_type').value = data.mal_authorization_token_type
        document.getElementById('expires_in').value = data.mal_authorization_expires_in
        document.getElementById('refresh_token').value = data.mal_authorization_refresh_token
        document.getElementById('mal_get_localhost_url').disabled = true
        document.getElementById('validate_mal_url').disabled = true
      } else {
        hideSpinner('validate')
        document.getElementById('mal_validated').value = 'false'
        statusMessage.textContent = data.error
        statusMessage.style.color = '#ea868f'
      }
      statusMessage.style.display = 'block'
    })
    .catch(error => {
      hideSpinner('validate')
      console.error('Error validating MAL credentials:', error)
      statusMessage.textContent = 'An error occurred while validating MAL credentials.'
      statusMessage.style.color = '#ea868f'
      statusMessage.style.display = 'block'
    })
})
/* eslint-enable camelcase */
