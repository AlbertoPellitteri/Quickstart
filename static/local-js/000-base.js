/* global $ */
document.addEventListener('DOMContentLoaded', function () {
  // Prevent form submission on "Enter" key press, except for textarea
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
      const form = event.target.closest('form')
      if (form) {
        event.preventDefault() // Prevent form submission
      }
    }
  })
})

// Loading spinner functionality
function loading (action) {
  console.log('action:', action)

  let spinnerIcon
  switch (action) {
    case 'prev':
      spinnerIcon = document.getElementById('prev-spinner-icon')
      break
    case 'next':
      spinnerIcon = document.getElementById('next-spinner-icon')
      break
    case 'jump':
      spinnerIcon = document.getElementById('next-spinner-icon') || document.getElementById('prev-spinner-icon')
      break
    default:
      console.error('Unsupported action:', action)
      return
  }

  if (spinnerIcon) {
    spinnerIcon.classList.remove('fa-arrow-left', 'fa-arrow-right')
    // spinnerIcon.classList.add('fa-spinner', 'fa-pulse', 'fa-fw');
    spinnerIcon.classList.add('spinner-border', 'spinner-border-sm')
  } else {
    console.error('Spinner icon not found for action:', action)
  }
}

/* eslint-disable no-unused-vars */
// Function to show the spinner on validate
function showSpinner (webhookType) {
  document.getElementById(`spinner_${webhookType}`).style.display = 'inline-block'
}

// Function to hide the spinner on validate
function hideSpinner (webhookType) {
  document.getElementById(`spinner_${webhookType}`).style.display = 'none'
}

// Function to handle jump to action
function jumpTo (targetPage) {
  console.log('JumpTo initiated for target page:', targetPage)

  const form = document.getElementById('configForm') || document.getElementById('final-form')

  if (!form) {
    console.error('Form not found')
    return
  }

  // Check form validity
  if (!form.checkValidity()) {
    console.warn('Form is invalid. Reporting validity.')
    form.reportValidity()
    return
  }

  console.log('Form is valid. Preparing to submit.')

  // Append custom webhook URLs to select elements if needed
  $('select.form-select').each(function () {
    if ($(this).val() === 'custom') {
      const customInputId = $(this).attr('id') + '_custom'
      const customUrl = $('#' + customInputId).find('input.custom-webhook-url').val()
      if (customUrl) {
        console.log(`Appending custom URL for ${$(this).attr('id')}:`, customUrl)
        $(this).append('<option value="' + customUrl + '" selected="selected">' + customUrl + '</option>')
        $(this).val(customUrl)
      }
    }
  })

  // Create FormData object from the form
  const formData = new FormData(form)

  // Debugging FormData content
  console.log('FormData before fetch:')
  formData.forEach((value, key) => {
    console.log(`${key}: ${value}`)
  })

  // Show loading spinner
  loading('jump')

  // Submit the form data via fetch without the jumpTo field
  fetch(form.action, {
    method: 'POST',
    body: formData
  }).then(response => {
    console.log('Fetch response received:', response.status)

    if (response.ok) {
      console.log('Redirecting to target page:', targetPage)
      // Redirect to the target page after successful form submission
      window.location.href = '/step/' + targetPage
    } else {
      console.error('Form submission failed:', response.statusText)
    }
  }).catch(error => {
    console.error('Error during form submission:', error)
  })
}/* eslint-enable no-unused-vars */
