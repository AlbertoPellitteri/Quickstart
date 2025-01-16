/* global $ */

$(document).ready(function () {
  const plexValid = $('#plex_valid').data('plex-valid') === 'True'
  console.log('Plex Valid:', plexValid)

  // Show or hide the libraries container based on Plex validation
  if (!plexValid) {
    $('#movie-libraries-container').hide()
    $('#show-libraries-container').hide()
    showValidationMessage(
      'Plex settings have not been validated successfully. Please return to that page and validate before proceeding.',
      'danger'
    )
    disableNavigation()
    return // Exit early since we cannot proceed without Plex validation
  } else {
    $('#movie-libraries-container').show()
    $('#show-libraries-container').show()
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

  // Validate form on submission
  $('#configForm').on('submit', function (e) {
    if (!validateForm()) {
      e.preventDefault() // Prevent form submission if validation fails
    }
  })

  // Initial validation check
  updateValidationState()

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
    $('#configForm button').prop('disabled', true)
    $('#configForm .dropdown-toggle').prop('disabled', true)

    if (!lockAccordions) {
      $('.accordion-button').prop('disabled', false)
    }
  }

  function enableNavigation () {
    $('#configForm button').prop('disabled', false)
    $('#configForm .dropdown-toggle').prop('disabled', false)
  }
})
