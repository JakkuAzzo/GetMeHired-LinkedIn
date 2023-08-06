chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'jobApplied') {
    console.log('Job Applied:', message.jobTitle);
  } else if (message.action === 'updateSearchTerm') {
    updateSearchTerm(message.searchTerm);
  }
});

function simulateApplyToJobListings() {
  const jobLinks = document.querySelectorAll('.job-card-list__title');
  let index = 0;

  const applyToNextJob = () => {
    if (index < jobLinks.length) {
      const jobLink = jobLinks[index];
      jobLink.click();

      setTimeout(() => {
        const applyButton = document.querySelector('.jobs-s-apply button');
        if (applyButton) {
          applyButton.click();
          const jobTitle = document.querySelector('.jobs-details-top-card__job-title').textContent.trim();
          sendApplyMessage(jobTitle);
        }

        setTimeout(() => {
          window.history.back();
          index++;
          setTimeout(applyToNextJob, 3000);
        }, 1000);
      }, 5000);
    }
  };

  applyToNextJob();
}

setTimeout(() => {
  simulateApplyToJobListings();
}, 5000);
