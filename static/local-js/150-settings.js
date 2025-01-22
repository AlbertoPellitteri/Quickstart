/* global $, alert */

document.addEventListener('DOMContentLoaded', function () {
  const saveSyncChangesButton = document.getElementById('saveSyncChangesButton')
  const saveExcludeChangesButton = document.getElementById('saveExcludeChangesButton')
  const configForm = document.getElementById('configForm')

  function setSettingsValidated (isValid) {
    const settingsValidatedInput = document.getElementById('settings_validated')
    settingsValidatedInput.value = isValid ? 'true' : 'false'
  }

  function submitFormData () {
    if (configForm.checkValidity()) {
      const formData = new FormData(configForm)
      fetch(configForm.action, {
        method: 'POST',
        body: formData
      })
        .then((response) => {
          if (response.ok) {
            console.log('Settings saved successfully.')
          } else {
            console.error('Error saving settings:', response.statusText)
          }
        })
        .catch((error) => {
          console.error('Error saving settings:', error)
        })
    } else {
      console.warn('Form validation failed. Data not saved.')
    }
  }

  setSettingsValidated(true)

  saveSyncChangesButton.addEventListener('click', function () {
    const selectedUsers = []
    const checkboxes = document.querySelectorAll('#syncUserListForm input[type="checkbox"]:checked')
    const allSelected = document.getElementById('sync_all_users').checked

    if (allSelected) {
      selectedUsers.push('all')
    } else {
      checkboxes.forEach((checkbox) => {
        if (checkbox.value !== 'all') {
          selectedUsers.push(checkbox.value)
        }
      })
    }

    const csvUsers = selectedUsers.join(', ')
    document.getElementById('playlist_sync_to_users').value = csvUsers
    $('#syncUsersModal').modal('hide')
    setSettingsValidated(true)
  })

  saveExcludeChangesButton.addEventListener('click', function () {
    const selectedUsers = []
    const checkboxes = document.querySelectorAll('#excludeUserListForm input[type="checkbox"]:checked')

    checkboxes.forEach((checkbox) => {
      selectedUsers.push(checkbox.value)
    })

    const csvUsers = selectedUsers.join(', ')
    document.getElementById('playlist_exclude_users').value = csvUsers
    $('#excludeUsersModal').modal('hide')
    setSettingsValidated(true)
  })

  const syncAllUsersCheckbox = document.getElementById('sync_all_users')
  syncAllUsersCheckbox.addEventListener('change', function () {
    if (this.checked) {
      const checkboxes = document.querySelectorAll('#syncUserListForm input[type="checkbox"]:not(#sync_all_users)')
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false
      })
    }
    setSettingsValidated(true)
  })

  const syncUserCheckboxes = document.querySelectorAll('#syncUserListForm input[type="checkbox"]:not(#sync_all_users)')
  syncUserCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', function () {
      if (this.checked) {
        syncAllUsersCheckbox.checked = false
      }
      setSettingsValidated(true)
    })
  })

  document.querySelectorAll('input, select, textarea').forEach((element) => {
    element.addEventListener('change', function () {
      setSettingsValidated(true)
    })
  })

  document.querySelectorAll('button[onclick], .dropdown-menu a').forEach((element) => {
    element.addEventListener('click', function () {
      submitFormData()
    })
  })
})

$(document).ready(function () {
  const isValidated = document.getElementById('settings_validated').value.toLowerCase()
  console.log('Validated: ' + isValidated)
})

function validatePath (input) {
  const pathRegex = /^(?:[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*|\\{2}[^\\/:*?"<>|\r\n]+(?:\\[^\\/:*?"<>|\r\n]+)*|(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+|\/(?:[^\/]+\/)*[^\/]*|\.{1,2}(?:\/[^\/]*)*|(?:[^\/]+\/)*[^\/]*)$/ // eslint-disable-line
  return pathRegex.test(input)
}

function validateCSVList (input) {
  if (!input) {
    return true
  }
  const csvRegex = /^(\s*[a-zA-Z0-9-_.]+\s*)(,\s*[a-zA-Z0-9-_.]+\s*)*$/
  return csvRegex.test(input)
}

/* eslint-disable no-unused-vars */
function validateNumericCSV (input) {
  if (!input || input.toLowerCase() === 'none') {
    return true
  }
  const numericCSVRegex = /^(\s*\d+\s*)(,\s*\d+\s*)*$/
  return numericCSVRegex.test(input)
}

function validateIMDBCSV (input) {
  if (!input || input.toLowerCase() === 'none') {
    return true
  }
  const imdbCSVRegex = /^(\s*tt\d{7,}\s*)(,\s*tt\d{7,}\s*)*$/
  return imdbCSVRegex.test(input)
}

function validateURL (input) {
  if (!input || input.toLowerCase() === 'none') {
    return true
  }
  const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
  return urlRegex.test(input)
}

function validateForm () {
  const assetDirectoryInput = document.getElementById('asset_directory').value.trim()

  if (!assetDirectoryInput || assetDirectoryInput.toLowerCase() === 'none' || !validatePath(assetDirectoryInput)) {
    alert('Please enter a valid asset directory path.')
    return false
  }

  const csvFields = ['playlist_sync_to_users', 'playlist_exclude_users']
  for (const fieldId of csvFields) {
    const fieldValue = document.getElementById(fieldId).value.trim()
    if (!validateCSVList(fieldValue)) {
      alert(`Please enter a valid CSV list for ${fieldId.replace('_', ' ')}.`)
      return false
    }
  }

  const ignoreIds = document.getElementById('ignore_ids').value.trim()
  if (ignoreIds && ignoreIds.toLower !== 'none' && !validateNumericCSV(ignoreIds)) {
    alert('Please enter a valid CSV list of numeric IDs for ignore_ids.')
    return false
  }

  const ignoreImdbIds = document.getElementById('ignore_imdb_ids').value.trim()
  if (ignoreImdbIds && ignoreImdbIds.toLower !== 'none' && !validateIMDBCSV(ignoreImdbIds)) {
    alert('Please enter a valid CSV list of IMDb IDs for ignore_imdb_ids (starting with tt followed by at least 7 digits).')
    return false
  }

  const customRepo = document.getElementById('custom_repo').value.trim()
  if (customRepo && customRepo.toLower !== 'none' && !validateURL(customRepo)) {
    alert('Please enter a valid URL for custom_repo.')
    return false
  }

  return true
}
