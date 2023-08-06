document.addEventListener('DOMContentLoaded', function() {
    const submitButton = document.getElementById('submitBtn');
    
    submitButton.addEventListener('click', function() {
      const searchTerm = document.getElementById('searchTerm').value;
      
      // Send the search term to the background script
      chrome.runtime.sendMessage({ action: 'updateSearchTerm', searchTerm });
      

    



      // Close the popup
      window.close();
    });
  });
  