/* global $ */

document.addEventListener('DOMContentLoaded', function () {
  const useSeparatorsToggle = document.getElementById('use_separators')
  const form = document.getElementById('librariesForm')

  if (useSeparatorsToggle) {
    useSeparatorsToggle.addEventListener('change', function () {
      const isChecked = useSeparatorsToggle.checked

      // Ensure award_separator and chart_separator toggles reflect use_separators
      document.getElementById('award_separator').checked = isChecked
      document.getElementById('chart_separator').checked = isChecked

      // Ensure form data always includes template_variables
      const hiddenTemplateVar = document.getElementById('template_variables')
      if (!hiddenTemplateVar) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = 'template_variables[use_separators]'
        input.id = 'template_variables'
        form.appendChild(input)
      }
      document.getElementById('template_variables').value = isChecked ? 'true' : 'false'
    })
  }
})

/* eslint-disable camelcase */
$(document).ready(function () {
  const mov_useSeparatorsToggle = $('#mov-attribute_use_separators')
  const mov_awardSeparatorToggle = $('#mov-collection_separator_award')
  const mov_chartSeparatorToggle = $('#mov-collection_separator_chart')
  const sho_useSeparatorsToggle = $('#sho-attribute_use_separators')
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

  function mov_updateSeparatorsState () {
    const isChecked = mov_useSeparatorsToggle.prop('checked')

    // Enable or disable based on the `use_separators` state
    mov_awardSeparatorToggle.prop('checked', isChecked)
    mov_chartSeparatorToggle.prop('checked', isChecked)
  }

  function sho_updateSeparatorsState () {
    const isChecked = sho_useSeparatorsToggle.prop('checked')

    // Enable or disable based on the `use_separators` state
    sho_awardSeparatorToggle.prop('checked', isChecked)
    sho_chartSeparatorToggle.prop('checked', isChecked)
  }

  // Run on page load to ensure initial state is correct
  mov_updateSeparatorsState()
  sho_updateSeparatorsState()

  // Listen for changes on `use_separators` and update accordingly
  mov_useSeparatorsToggle.change(function () {
    mov_updateSeparatorsState()
  })

  // Listen for changes on `use_separators` and update accordingly
  sho_useSeparatorsToggle.change(function () {
    sho_updateSeparatorsState()
  })

  // Ensure values are stored properly before form submission
  $('#configForm').submit(function () {
    $('input[name="mov-template_variables[use_separators]"]').val(mov_useSeparatorsToggle.prop('checked') ? 'true' : 'false')
    $('input[name="mov-collection_separator_award"]').val(mov_awardSeparatorToggle.prop('checked') ? 'true' : 'false')
    $('input[name="mov-collection_separator_chart"]').val(mov_chartSeparatorToggle.prop('checked') ? 'true' : 'false')
    $('input[name="mov-attribute_use_separators"]').val(mov_useSeparatorsToggle.prop('checked') ? 'true' : 'false')
    $('input[name="sho-collection_separator_award"]').val(sho_awardSeparatorToggle.prop('checked') ? 'true' : 'false')
    $('input[name="sho-collection_separator_chart"]').val(sho_chartSeparatorToggle.prop('checked') ? 'true' : 'false')
    $('input[name="sho-attribute_use_separators"]').val(sho_useSeparatorsToggle.prop('checked') ? 'true' : 'false')
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
