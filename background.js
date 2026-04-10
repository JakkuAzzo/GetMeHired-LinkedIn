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
const STORAGE_KEYS = {
  settings: 'gmhLinkedInSettings',
  state: 'gmhLinkedInState',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEYS.settings, STORAGE_KEYS.state], (items) => {
    if (!items[STORAGE_KEYS.settings]) {
      chrome.storage.local.set({
        [STORAGE_KEYS.settings]: {
          fullName: 'Nathan Brown-Bennett',
          email: 'nathan-brown-bennett@hotmail.com',
          phone: '07800931786',
          location: 'London',
          currentCompany: 'Lunarversal',
          githubUrl: 'https://github.com/NathanBrownBennett',
          portfolioUrl: 'https://nathanbrownbennett.github.io/NathanBrown-Bennett/',
          linkedinUrl: 'https://www.linkedin.com/in/nathan-brown-bennett/',
          yearsExperience: '3',
          workAuthorized: true,
          sponsorshipRequired: false,
          hybridOk: true,
          openSourceContribution: false,
          resumeName: '',
          resumeDataUrl: '',
          resumeMimeType: 'application/pdf',
        },
      });
    }

    if (!items[STORAGE_KEYS.state]) {
      chrome.storage.local.set({
        [STORAGE_KEYS.state]: {
          enabled: false,
          queue: [],
          index: 0,
          appliedJobIds: [],
          lastJobId: '',
          lastStatus: 'idle',
          updatedAt: Date.now(),
        },
      });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GMH_SAVE_SETTINGS') {
    chrome.storage.local.set({ [STORAGE_KEYS.settings]: message.settings }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === 'GMH_GET_SETTINGS') {
    chrome.storage.local.get(STORAGE_KEYS.settings, (items) => {
      sendResponse({ ok: true, settings: items[STORAGE_KEYS.settings] || null });
    });
    return true;
  }

  if (message?.type === 'GMH_GET_STATE') {
    chrome.storage.local.get(STORAGE_KEYS.state, (items) => {
      sendResponse({ ok: true, state: items[STORAGE_KEYS.state] || null });
    });
    return true;
  }

  if (message?.type === 'GMH_SET_STATE') {
    chrome.storage.local.set({ [STORAGE_KEYS.state]: message.state }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === 'GMH_START_AUTOMATION') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab' });
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'GMH_START_AUTOMATION' }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }

        sendResponse(response || { ok: true });
      });
    });
    return true;
  }

  if (message?.type === 'GMH_LOG') {
    console.log('[GMH]', message.message);
  }
});