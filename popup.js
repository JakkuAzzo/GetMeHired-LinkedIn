document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('jobSearchForm');
  const runButton = document.getElementById('runBtn');
  
  // Listen for input changes
  form.addEventListener('input', function() {
    // Enable the "Run" button when all required fields are filled
    const searchTerm = document.getElementById('searchTerm').value;
    if (searchTerm.trim() !== '') {
      runButton.removeAttribute('disabled');
    } else {
      runButton.setAttribute('disabled', true);
    }
  });
  
  // Listen for the "Run" button click
  runButton.addEventListener('click', function(event) {
    event.preventDefault();
    
    // Collect input data and send it to the background script
    const searchData = {
      searchTerm: document.getElementById('searchTerm').value,
      // Collect other input data similarly
    };
    chrome.runtime.sendMessage({ action: 'startJobSearch', searchData });
    
    // Close the popup window
    window.close();
  });
});
