/* global $ */

document.addEventListener('DOMContentLoaded', function () {
  function updateHiddenInputs (prefix) {
    const form = document.getElementById('configForm') // Ensure form exists
    if (!form) {
      console.error("[ERROR] Form element 'configForm' not found!")
      return // Stop execution if form is missing
    }

    const useSeparatorsDropdown = document.getElementById(`${prefix}-attribute_use_separators`)
    let useSeparatorsInput = document.getElementById(`${prefix}-template_variables_use_separators`)
    let sepStyleInput = document.getElementById(`${prefix}-template_variables_sep_style`)

    // Get related toggles
    const chartSeparatorToggle = document.getElementById(`${prefix}-collection_separator_chart`)
    const awardSeparatorToggle = document.getElementById(`${prefix}-collection_separator_award`)

    // Debugging Logs
    console.log(`[DEBUG] ${prefix}-attribute_use_separators changed to:`, useSeparatorsDropdown?.value)
    console.log('[DEBUG] Chart Separator Toggle Exists:', !!chartSeparatorToggle)
    console.log('[DEBUG] Award Separator Toggle Exists:', !!awardSeparatorToggle)

    const selectedValue = useSeparatorsDropdown.value
    const isEnabled = selectedValue !== 'none'

    // Ensure hidden inputs exist
    if (!useSeparatorsInput) {
      useSeparatorsInput = document.createElement('input')
      useSeparatorsInput.type = 'hidden'
      useSeparatorsInput.name = `${prefix}-template_variables[use_separators]`
      useSeparatorsInput.id = `${prefix}-template_variables_use_separators`
      form.appendChild(useSeparatorsInput)
    }
    useSeparatorsInput.value = isEnabled ? 'true' : 'false'

    if (!sepStyleInput) {
      sepStyleInput = document.createElement('input')
      sepStyleInput.type = 'hidden'
      sepStyleInput.name = `${prefix}-template_variables[sep_style]`
      sepStyleInput.id = `${prefix}-template_variables_sep_style`
      form.appendChild(sepStyleInput)
    }
    sepStyleInput.value = isEnabled ? selectedValue : ''

    // Fix: Enable/Disable & Check/Uncheck Chart & Award Separator Toggles
    if (chartSeparatorToggle && awardSeparatorToggle) {
      chartSeparatorToggle.disabled = !isEnabled
      awardSeparatorToggle.disabled = !isEnabled

      if (isEnabled) {
        chartSeparatorToggle.checked = true
        awardSeparatorToggle.checked = true
      } else {
        chartSeparatorToggle.checked = false
        awardSeparatorToggle.checked = false
      }

      // Debugging
      console.log('[DEBUG] Chart Separator Toggle is now:', chartSeparatorToggle.checked)
      console.log('[DEBUG] Award Separator Toggle is now:', awardSeparatorToggle.checked)
    }
  }

  // Apply for both Movies (mov) and Shows (sho)
  ['mov', 'sho'].forEach(prefix => {
    const dropdown = document.getElementById(`${prefix}-attribute_use_separators`)
    if (dropdown) {
      dropdown.addEventListener('change', function () {
        console.log(`[DEBUG] ${prefix}-attribute_use_separators dropdown changed`)
        updateHiddenInputs(prefix)
      })
      updateHiddenInputs(prefix) // Run once on load
    } else {
      console.error(`[ERROR] Dropdown ${prefix}-attribute_use_separators not found!`)
    }
  })

  // Updated Form Submission Logic
  $('#configForm').submit(function () {
    ['mov', 'sho'].forEach(prefix => {
      const useSeparatorsDropdown = document.getElementById(`${prefix}-attribute_use_separators`)
      const useSeparatorsValue = useSeparatorsDropdown ? useSeparatorsDropdown.value : 'none'

      $('input[name="' + prefix + '-template_variables[use_separators]"]').val(useSeparatorsValue !== 'none' ? 'true' : 'false')
      $('input[name="' + prefix + '-template_variables[sep_style]"]').val(useSeparatorsValue !== 'none' ? useSeparatorsValue : '')

      $('input[name="' + prefix + '-collection_separator_award"]').val($('#' + prefix + '-collection_separator_award').prop('checked') ? 'true' : 'false')
      $('input[name="' + prefix + '-collection_separator_chart"]').val($('#' + prefix + '-collection_separator_chart').prop('checked') ? 'true' : 'false')
    })
  })
})

/* eslint-disable camelcase */
$(document).ready(function () {
  const mov_awardSeparatorToggle = $('#mov-collection_separator_award')
  const mov_chartSeparatorToggle = $('#mov-collection_separator_chart')
  const sho_awardSeparatorToggle = $('#sho-collection_separator_award')
  const sho_chartSeparatorToggle = $('#sho-collection_separator_chart')
  const plexValid = $('#plex_valid').data('plex-valid') === 'True'
  console.log('Plex Valid:', plexValid)

  // Show or hide the libraries container based on Plex validation
  if (!plexValid) {
    $('#all-accordions-container').hide()
    showValidationMessage(
      'Plex settings have not been validated successfully. Please return to that page and validate before proceeding.',
      'danger'
    )
    disableNavigation()
    return // Exit early since we cannot proceed without Plex validation
  } else {
    $('#all-accordions-container').show()
  }

  // Restore saved library selections
  const librariesInput = $('#libraries')
  if (!librariesInput.val()) {
    console.log('Libraries field is empty. Initializing...')
    librariesInput.val('') // Initialize if empty
  }
  const selectedLibraries = librariesInput.val().split(',').map(item => item.trim())
  console.log('Restoring Selected Libraries:', selectedLibraries)

  $('.library-checkbox').each(function () {
    if (selectedLibraries.includes($(this).val())) {
      $(this).prop('checked', true)
    }
  })

  // Attach change listeners to library and accordion checkboxes
  $('.library-checkbox, .accordion-item input[type="checkbox"]').change(function () {
    updateValidationState()
  })

  // Initial validation check
  updateValidationState()

  // Ensure values are stored properly before form submission
  $('#configForm').submit(function () {
    $('input[name="mov-collection_separator_award"]').val(mov_awardSeparatorToggle.prop('checked') ? 'true' : 'false')
    $('input[name="mov-collection_separator_chart"]').val(mov_chartSeparatorToggle.prop('checked') ? 'true' : 'false')
    $('input[name="sho-collection_separator_award"]').val(sho_awardSeparatorToggle.prop('checked') ? 'true' : 'false')
    $('input[name="sho-collection_separator_chart"]').val(sho_chartSeparatorToggle.prop('checked') ? 'true' : 'false')
  })
  /* eslint-enable camelcase */

  function updateValidationState () {
    const selectedMovieLibraries = getSelectedLibraries('mov-library_')
    const selectedShowLibraries = getSelectedLibraries('sho-library_')
    const isValid = validateForm()

    // Update libraries input value
    $('#libraries').val([...selectedMovieLibraries, ...selectedShowLibraries].join(', '))
    $('#libraries_validated').val(isValid ? 'true' : 'false')

    if (isValid) {
      showValidationMessage('Validation successful! You may proceed.', 'success')
      enableNavigation()
    } else {
      showValidationMessage(
        'You must select at least one library and at least one corresponding accordion item.',
        'danger'
      )
      disableNavigation(false) // Allow interaction with the accordions
    }
  }

  function validateForm () {
    // Check movie libraries and accordions
    const movieLibrarySelected = $('[id^="mov-library_"]:checked').length > 0
    const movieAccordionSelected = $('#accordionMovies .accordion-item input[type="checkbox"]:checked').length > 0

    // Check show libraries and accordions
    const showLibrarySelected = $('[id^="sho-library_"]:checked').length > 0
    const showAccordionSelected = $('#accordionShows .accordion-item input[type="checkbox"]:checked').length > 0

    // Determine if movies and shows are independently valid
    const moviesValid = !movieLibrarySelected || movieAccordionSelected // Movie valid if no library or accordion selected
    const showsValid = !showLibrarySelected || showAccordionSelected // Show valid if no library or accordion selected

    // Validate that at least one library is selected
    const atLeastOneLibrarySelected = movieLibrarySelected || showLibrarySelected
    const librariesValid = moviesValid && showsValid

    // Debug logs for validation state
    console.log('Validation Debug Logs:')
    console.log('  Movie Library Selected:', movieLibrarySelected)
    console.log('  Movie Accordion Selected:', movieAccordionSelected)
    console.log('  Show Library Selected:', showLibrarySelected)
    console.log('  Show Accordion Selected:', showAccordionSelected)
    console.log('  Movies Valid:', moviesValid)
    console.log('  Shows Valid:', showsValid)
    console.log('  At Least One Library Selected:', atLeastOneLibrarySelected)
    console.log('  Libraries Valid:', librariesValid)
    console.log('  Final Validation Result:', atLeastOneLibrarySelected && librariesValid)

    return atLeastOneLibrarySelected && librariesValid
  }

  function getSelectedLibraries (prefix) {
    return $(`[id^="${prefix}"]:checked`).map(function () {
      return $(this).val()
    }).get()
  }

  function showValidationMessage (message, type) {
    const validationBox = $('#validation-messages')
    validationBox
      .html(message)
      .removeClass('alert-danger alert-success')
      .addClass(`alert-${type}`)
      .show()
  }

  function disableNavigation (lockAccordions = true) {
    // Disable the Jump To and Next buttons
    $('#configForm .dropdown-toggle').prop('disabled', true) // Jump To dropdown
    $('#configForm button[onclick*="next"]').prop('disabled', true) // Next button

    // Keep the Previous button enabled at all times
    $('#configForm button[onclick*="prev"]').prop('disabled', false) // Enable Previous button

    // Handle accordions based on the lockAccordions flag
    if (!lockAccordions) {
      $('.accordion-button').prop('disabled', false) // Keep accordions interactive
    }
  }

  function enableNavigation () {
    $('#configForm button').prop('disabled', false)
    $('#configForm .dropdown-toggle').prop('disabled', false)
  }
})
