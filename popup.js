const STORAGE_KEY = 'gmhLinkedInSettings';

const defaultSettings = {
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
  cvKeywords: 'cyber security, security engineer, application security, devsecops, soc, threat intelligence, network security, cloud security',
  resumeName: '',
  resumeDataUrl: '',
  resumeMimeType: 'application/pdf',
};

document.addEventListener('DOMContentLoaded', async () => {
  const saveButton = document.getElementById('saveBtn');
  const runButton = document.getElementById('runBtn');
  const stopButton = document.getElementById('stopBtn');
  const resumeInput = document.getElementById('cvUpload');
  const resumeStatus = document.getElementById('resumeStatus');
  const statusLog = document.getElementById('statusLog');

  const fieldIds = [
    'fullName', 'email', 'phone', 'location', 'currentCompany', 'yearsExperience',
    'githubUrl', 'portfolioUrl', 'workAuthorized', 'sponsorshipRequired',
    'hybridOk', 'openSourceContribution', 'cvKeywords',
  ];

  const renderStatus = (message) => {
    statusLog.textContent = message;
  };

  const getFields = () => ({
    fullName: document.getElementById('fullName').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    location: document.getElementById('location').value.trim(),
    currentCompany: document.getElementById('currentCompany').value.trim(),
    githubUrl: document.getElementById('githubUrl').value.trim(),
    portfolioUrl: document.getElementById('portfolioUrl').value.trim(),
    yearsExperience: document.getElementById('yearsExperience').value.trim(),
    cvKeywords: document.getElementById('cvKeywords').value.trim(),
    workAuthorized: document.getElementById('workAuthorized').checked,
    sponsorshipRequired: document.getElementById('sponsorshipRequired').checked,
    hybridOk: document.getElementById('hybridOk').checked,
    openSourceContribution: document.getElementById('openSourceContribution').checked,
  });

  const setFields = (settings) => {
    document.getElementById('fullName').value = settings.fullName || '';
    document.getElementById('email').value = settings.email || '';
    document.getElementById('phone').value = settings.phone || '';
    document.getElementById('location').value = settings.location || '';
    document.getElementById('currentCompany').value = settings.currentCompany || '';
    document.getElementById('yearsExperience').value = settings.yearsExperience || '';
    document.getElementById('cvKeywords').value = settings.cvKeywords || '';
    document.getElementById('githubUrl').value = settings.githubUrl || '';
    document.getElementById('portfolioUrl').value = settings.portfolioUrl || '';
    document.getElementById('workAuthorized').checked = Boolean(settings.workAuthorized);
    document.getElementById('sponsorshipRequired').checked = Boolean(settings.sponsorshipRequired);
    document.getElementById('hybridOk').checked = Boolean(settings.hybridOk);
    document.getElementById('openSourceContribution').checked = Boolean(settings.openSourceContribution);
    if (settings.resumeName) {
      resumeStatus.textContent = `Resume loaded: ${settings.resumeName}`;
    }
  };

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  let currentSettings = { ...defaultSettings, ...(stored[STORAGE_KEY] || {}) };
  setFields(currentSettings);

  fieldIds.forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      runButton.disabled = !document.getElementById('fullName').value.trim() || !document.getElementById('email').value.trim();
    });
  });

  resumeInput.addEventListener('change', async () => {
    const file = resumeInput.files && resumeInput.files[0];
    if (!file) {
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const nextSettings = {
      ...currentSettings,
      ...getFields(),
      resumeName: file.name,
      resumeDataUrl: dataUrl,
      resumeMimeType: file.type || 'application/pdf',
    };

    currentSettings = nextSettings;
    await chrome.storage.local.set({ [STORAGE_KEY]: nextSettings });
    resumeStatus.textContent = `Resume loaded: ${file.name}`;
    renderStatus('Resume saved to the extension profile.');
    runButton.disabled = false;
  });

  saveButton.addEventListener('click', async () => {
    const nextSettings = {
      ...currentSettings,
      ...getFields(),
    };

    currentSettings = nextSettings;
    await chrome.storage.local.set({ [STORAGE_KEY]: nextSettings });
    renderStatus('Profile saved. Open a LinkedIn jobs page, then click Run.');
  });

  const resolveLinkedInTab = async () => {
    const [activeInWindow] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
      url: ['*://*.linkedin.com/*', '*://linkedin.com/*'],
    });

    return activeInWindow || (await chrome.tabs.query({
      url: ['*://*.linkedin.com/*', '*://linkedin.com/*'],
    })).sort((left, right) => {
      const activeDelta = Number(Boolean(right.active)) - Number(Boolean(left.active));
      if (activeDelta !== 0) {
        return activeDelta;
      }
      return (right.lastAccessed || 0) - (left.lastAccessed || 0);
    })[0];
  };

  runButton.addEventListener('click', async () => {
    const nextSettings = {
      ...currentSettings,
      ...getFields(),
    };

    currentSettings = nextSettings;
    await chrome.storage.local.set({ [STORAGE_KEY]: nextSettings });
    const tab = await resolveLinkedInTab();

    if (!tab?.id) {
      renderStatus('No active LinkedIn tab was found.');
      return;
    }

    const sendMessage = (type) => new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message, response: null });
          return;
        }

        resolve({ ok: true, error: null, response });
      });
    });

    let result = await sendMessage('GMH_START_AUTOMATION');

    if (!result.ok && /Receiving end does not exist/i.test(result.error || '')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch (error) {
        renderStatus(`Could not inject automation script: ${error?.message || String(error)}`);
        return;
      }

      result = await sendMessage('GMH_START_AUTOMATION');
    }

    if (!result.ok) {
      renderStatus(`Could not start automation: ${result.error}`);
      return;
    }

    renderStatus(result.response?.message || 'Automation started in the active LinkedIn tab.');
  });

  stopButton.addEventListener('click', async () => {
    const tab = await resolveLinkedInTab();
    if (!tab?.id) {
      renderStatus('No active LinkedIn tab was found.');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'GMH_STOP_AUTOMATION' }, (response) => {
      if (chrome.runtime.lastError) {
        renderStatus(`Stop failed: ${chrome.runtime.lastError.message}`);
        return;
      }

      renderStatus(response?.message || 'Stop signal sent.');
    });
  });

  runButton.disabled = !document.getElementById('fullName').value.trim() || !document.getElementById('email').value.trim();
});
