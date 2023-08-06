let searchTerm = 'cyber';

function performJobSearchAndApply() {
  const delay = Math.random() * (5000 - 2000) + 2000;
  simulateJobSearchAndApply();
  setTimeout(performJobSearchAndApply, delay);
}

function simulateHumanInput() {
  window.scrollBy(0, 100);
  const jobLinks = document.querySelectorAll('.job-card-list__title');
  if (jobLinks.length > 0) {
    const randomIndex = Math.floor(Math.random() * jobLinks.length);
    jobLinks[randomIndex].click();
    const delay = Math.random() * (7000 - 3000) + 3000;
    setTimeout(simulateHumanInput, delay);
  }
}

function simulateUserEngagement() {
  const jobLinks = document.querySelectorAll('.job-card-list__title');
  if (jobLinks.length > 0) {
    const randomIndex = Math.floor(Math.random() * jobLinks.length);
    jobLinks[randomIndex].click();
    window.scrollBy(0, 200);
    const delay = Math.random() * (30000 - 15000) + 15000;
    setTimeout(simulateUserEngagement, delay);
  }
}

function applyRateLimiting() {
  const pauseDuration = 60 * 1000;
  setTimeout(() => {
    applyRateLimiting();
  }, pauseDuration);
}

function simulateJobSearchAndApply() {
  const searchInput = document.querySelector('#jobs-search-box-keyword-id-ember790');
  
  if (searchInput) {
    searchInput.value = searchTerm;
    const searchForm = searchInput.closest('form');
    if (searchForm) {
      searchForm.submit();
      setTimeout(simulateApplyToJobListings, 5000);
    }
  }
}

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
          console.log('Simulated applying to a job.');
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

const initialDelay = 5000;
setTimeout(() => {
  performJobSearchAndApply();
}, initialDelay);

const humanInputInitialDelay = 10 * 60 * 1000;
setTimeout(() => {
  simulateHumanInput();
}, humanInputInitialDelay);

const userEngagementInitialDelay = 30 * 60 * 1000;
setTimeout(() => {
  simulateUserEngagement();
}, userEngagementInitialDelay);

const rateLimitingInterval = 5 * 60 * 1000;
setInterval(() => {
  applyRateLimiting();
}, rateLimitingInterval);

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startJobSearch') {
    // Start the job search process using the provided searchData
    startJobSearch(message.searchData);
  }
});