/* global $ */

const validatedWebhooks = {}

function setWebhookValidated (state, webhookType = null) {
  document.getElementById('webhooks_validated').value = state ? 'true' : 'false'

  if (webhookType) {
    // Enable the validate button if the URL changes and validation is false
    const validateButton = document.querySelector(`#webhooks_${webhookType}_custom .validate-button`)
    if (validateButton) {
      validateButton.disabled = state
    }
  }
}

function showCustomInput (selectElement, isValidated) {
  const customInputId = selectElement.id + '_custom'
  console.log(`showCustomInput called for: ${selectElement.id}, isValidated: ${isValidated}`)
  if (selectElement.value === 'custom') {
    document.getElementById(customInputId).style.display = 'block'
    if (isValidated === true) {
      setWebhookValidated(true, selectElement.id)
    } else {
      setWebhookValidated(false, selectElement.id)
    }
  } else {
    document.getElementById(customInputId).style.display = 'none'
    validatedWebhooks[selectElement.id] = true
    updateValidationState()
  }
}

function updateValidationState () {
  const allValid = Object.values(validatedWebhooks).every(state => state === true)
  console.log('Validation State Updated:', validatedWebhooks, `All Valid: ${allValid}`)
  setWebhookValidated(allValid)
}

$(document).ready(function () {
  const isValidated = document.getElementById('webhooks_validated').value.toLowerCase() === 'true'
  console.log('Page Load - Is Validated:', isValidated)

  $('select.form-select').each(function () {
    const selectElement = this
    const customInputId = selectElement.id + '_custom'
    const customUrl = $('#' + customInputId).find('input.custom-webhook-url').val()

    showCustomInput(selectElement, isValidated)

    if (selectElement.value === 'custom' && customUrl) {
      validatedWebhooks[selectElement.id] = isValidated
      console.log(`Custom webhook found: ${selectElement.id}, URL: ${customUrl}`)
    } else {
      validatedWebhooks[selectElement.id] = true
    }
  })

  if (isValidated === true) {
    $('.validate-button').prop('disabled', true)
  } else {
    $('.validate-button').prop('disabled', false)
  }

  // Debugging for navigation actions
  document.getElementById('configForm').addEventListener('submit', function (event) {
    const actionType = event.submitter?.getAttribute('onclick')?.includes('loading') ? event.submitter.innerText.trim() : 'unknown'
    console.log(`Form Submitted - Action: ${actionType}`)

    $('select.form-select').each(function () {
      if ($(this).val() === 'custom') {
        const customInputId = $(this).attr('id') + '_custom'
        const customUrl = $('#' + customInputId).find('input.custom-webhook-url').val()
        if (customUrl) {
          console.log(`Serializing custom webhook for dropdown: ${$(this).attr('id')}, URL: ${customUrl}`)
          $(this).append('<option value="' + customUrl + '" selected="selected">' + customUrl + '</option>')
          $(this).val(customUrl)
        } else {
          console.log(`Custom webhook dropdown ${$(this).attr('id')} has no URL to serialize.`)
        }
      }
    })
  })
})

/* eslint-disable no-unused-vars, no-undef */
function validateWebhook (webhookType) {
  const inputGroup = $('#webhooks_' + webhookType + '_custom').find('.input-group')
  const webhookUrl = inputGroup.find('input.custom-webhook-url').val()
  const validationMessage = inputGroup.siblings('.validation-message')
  const validateButton = inputGroup.find('.validate-button')
  const webhookTypeFormatted = webhookType.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase() })

  console.log(`Validating webhook: ${webhookType}, URL: ${webhookUrl}`)

  showSpinner(webhookType)
  validationMessage.html('<div class="alert alert-info" role="alert">Validating...</div>')
  validationMessage.show()

  fetch('/validate_webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      webhook_url: webhookUrl,
      message: 'Test message for ' + webhookTypeFormatted + ' webhook'
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`Webhook validation successful for: ${webhookType}`)
        hideSpinner(webhookType)
        validationMessage.html('<div class="alert alert-success" role="alert">' + data.success + '</div>')
        validateButton.prop('disabled', true)
        validatedWebhooks['webhooks_' + webhookType] = true
      } else {
        console.error(`Webhook validation failed for: ${webhookType}, Error: ${data.error}`)
        hideSpinner(webhookType)
        validationMessage.html('<div class="alert alert-danger" role="alert">' + data.error + '</div>')
        validatedWebhooks['webhooks_' + webhookType] = false
      }
      updateValidationState()
    })
    .catch((error) => {
      console.error(`Error during webhook validation for: ${webhookType}`, error)
      hideSpinner(webhookType)
      validationMessage.html('<div class="alert alert-danger" role="alert">An error occurred. Please try again.</div>')
      validatedWebhooks['webhooks_' + webhookType] = false
      updateValidationState()
    })
}
/* eslint-enable no-unused-vars, no-undef */
