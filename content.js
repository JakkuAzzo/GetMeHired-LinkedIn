const STORAGE_KEYS = {
  settings: 'gmhLinkedInSettings',
  state: 'gmhLinkedInState',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function setNativeValue(element, value) {
  let descriptor;
  if (element instanceof HTMLInputElement) {
    descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  } else if (element instanceof HTMLTextAreaElement) {
    descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  } else if (element instanceof HTMLSelectElement) {
    descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  }

  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function getSettings() {
  return chrome.storage.local.get(STORAGE_KEYS.settings).then((items) => items[STORAGE_KEYS.settings] || {});
}

function getState() {
  return chrome.storage.local.get(STORAGE_KEYS.state).then((items) => items[STORAGE_KEYS.state] || { enabled: false, queue: [], index: 0, appliedJobIds: [] });
}

function setState(state) {
  return chrome.storage.local.set({ [STORAGE_KEYS.state]: state });
}

function log(message) {
  chrome.runtime.sendMessage({ type: 'GMH_LOG', message }).catch(() => {});
}

function isLinkedInJobsPage() {
  return /linkedin\.com$/.test(location.hostname) || location.hostname.endsWith('.linkedin.com');
}

function findDialog() {
  return document.querySelector('[role="dialog"], .artdeco-modal');
}

function getButtonText(button) {
  return normalizeText(button.innerText || button.getAttribute('aria-label') || button.textContent || '');
}

function clickFirstButton(root, patterns) {
  const buttons = Array.from(root.querySelectorAll('button, a, [role="button"]'));
  const button = buttons.find((candidate) => {
    const text = getButtonText(candidate);
    return patterns.some((pattern) => pattern.test(text));
  });

  if (!button) {
    return false;
  }

  button.click();
  return true;
}

function openFirstEasyApplyCard() {
  const cards = Array.from(document.querySelectorAll('li.scaffold-layout__list-item, .job-card-container, li, article'));
  const card = cards.find((candidate) => {
    const text = normalizeText(candidate.innerText || '');
    return /easy apply/i.test(text) && !/easy apply filter/i.test(text);
  });

  if (!card) {
    return false;
  }

  card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return true;
}

function openDetailEasyApply() {
  const target = Array.from(document.querySelectorAll('button, a, [role="button"]')).find((candidate) => {
    const text = getButtonText(candidate).toLowerCase();
    return (text === 'easy apply' || text.startsWith('easy apply to')) && !/filter/i.test(text);
  });

  if (!target) {
    return false;
  }

  target.click();
  return true;
}

function selectOptionByHints(selectElement, hints) {
  const wanted = hints.map((item) => normalizeText(item).toLowerCase());
  const option = Array.from(selectElement.options).find((candidate) => {
    const text = normalizeText(candidate.textContent).toLowerCase();
    const value = normalizeText(candidate.value).toLowerCase();
    return wanted.some((hint) => text.includes(hint) || value.includes(hint));
  });

  if (!option) {
    return false;
  }

  setNativeValue(selectElement, option.value);
  return true;
}

function inferAnswer(questionText, settings) {
  const text = normalizeText(questionText).toLowerCase();

  if (/right to work|work authorization|authorized to work|visa sponsorship|sponsorship/i.test(text)) {
    return settings.workAuthorized ? 'Yes' : 'No';
  }

  if (/currently in a security architecture role/i.test(text)) {
    return 'No';
  }

  if (/technical security architecture services|threat modelling|risk assessments|secure blueprints/i.test(text)) {
    return 'Yes';
  }

  if (/azure and microsoft 365|microsoft 365|azure/i.test(text)) {
    return 'No';
  }

  if (/industry frameworks|nist|cis|iso 27001|cyber essentials|ncsc caf/i.test(text)) {
    return 'No';
  }

  if (/ms certifications|sc-100|sc-900|az-900|az-104|az-305/i.test(text)) {
    return 'No';
  }

  if (/client facing consulting/i.test(text)) {
    return 'Yes';
  }

  if (/continuously lived in the uk|5\+ years/i.test(text)) {
    return 'Yes';
  }

  if (/hybrid/i.test(text)) {
    return settings.hybridOk ? 'Yes' : 'No';
  }

  if (/open source/i.test(text)) {
    return settings.openSourceContribution ? 'Yes' : 'No';
  }

  return 'No';
}

function fillInputs(root, settings) {
  const controls = Array.from(root.querySelectorAll('input, textarea, select'));

  for (const control of controls) {
    const label = normalizeText([
      control.labels?.[0]?.innerText,
      control.getAttribute('aria-label'),
      control.getAttribute('placeholder'),
    ].filter(Boolean).join(' ')).toLowerCase();

    if (!label) {
      continue;
    }

    if (control.tagName === 'SELECT') {
      if (/phone country code/.test(label)) {
        selectOptionByHints(control, ['united kingdom (+44)', '+44', 'uk']);
      }
      continue;
    }

    if (/email/.test(label) && !control.value) {
      setNativeValue(control, settings.email || '');
      continue;
    }

    if (/phone/.test(label) && !control.value) {
      setNativeValue(control, settings.phone || '');
      continue;
    }

    if (/name/.test(label) && !control.value) {
      setNativeValue(control, settings.fullName || '');
      continue;
    }

    if (/location|city/.test(label) && !control.value) {
      setNativeValue(control, settings.location || 'London');
      continue;
    }

    if (/company/.test(label) && !control.value) {
      setNativeValue(control, settings.currentCompany || '');
      continue;
    }

    if (control.type === 'number' && !control.value) {
      setNativeValue(control, settings.yearsExperience || '3');
    }
  }
}

function fillQuestionnaires(root, settings) {
  const questions = Array.from(root.querySelectorAll('fieldset, [role="radiogroup"], .fb-dash-form-element, .artdeco-form__section'));

  for (const question of questions) {
    const text = normalizeText(question.innerText || '');
    if (!text) {
      continue;
    }

    const answer = inferAnswer(text, settings);
    const radios = Array.from(question.querySelectorAll('input[type="radio"]'));
    if (radios.length === 0) {
      const select = question.querySelector('select');
      if (select && select.value === 'Select an option') {
        const options = Array.from(select.options);
        const match = options.find((option) => normalizeText(option.textContent).toLowerCase() === answer.toLowerCase())
          || options.find((option) => normalizeText(option.textContent).toLowerCase().includes(answer.toLowerCase()));
        if (match) {
          setNativeValue(select, match.value);
        }
      }
      continue;
    }

    const radio = radios.find((candidate) => {
      const label = normalizeText(candidate.closest('label')?.innerText || candidate.parentElement?.innerText || '').toLowerCase();
      return label === answer.toLowerCase() || label.includes(answer.toLowerCase());
    });

    if (radio) {
      radio.click();
    }
  }
}

function attachResume(root, settings) {
  const input = Array.from(root.querySelectorAll('input[type="file"]')).find((candidate) => candidate.offsetParent !== null || candidate.closest('[role="dialog"]'));
  if (!input || !settings.resumeDataUrl) {
    return false;
  }

  const match = settings.resumeDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return false;
  }

  const raw = atob(match[2]);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  const file = new File([bytes], settings.resumeName || 'resume.pdf', { type: match[1] || settings.resumeMimeType || 'application/pdf' });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

async function processDialog(settings) {
  const dialog = findDialog();
  if (!dialog) {
    return false;
  }

  attachResume(dialog, settings);
  fillInputs(dialog, settings);
  fillQuestionnaires(dialog, settings);

  const nextClicked = clickFirstButton(dialog, [
    /\bnext\b/i,
    /\breview\b/i,
    /\bcontinue\b/i,
    /\bsubmit application\b/i,
    /\bsubmit\b/i,
  ]);

  return nextClicked;
}

function openEasyApplyFromSearch() {
  const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const target = buttons.find((button) => {
    const text = getButtonText(button).toLowerCase();
    return text.startsWith('easy apply to') || text === 'easy apply' || text.includes('easy apply to');
  });

  if (target) {
    target.click();
    return true;
  }

  return false;
}

async function runAutomation() {
  if (!isLinkedInJobsPage()) {
    return { ok: false, message: 'Not on a LinkedIn page' };
  }

  const settings = await getSettings();
  await setState({ enabled: true, queue: [], index: 0, appliedJobIds: [], lastStatus: 'running', updatedAt: Date.now() });

  // First try the currently visible job details pane, which is where LinkedIn usually renders the real Easy Apply button.
  if (!findDialog()) {
    let openedModal = false;
    for (let attempt = 0; attempt < 6 && !openedModal; attempt += 1) {
      openedModal = openDetailEasyApply();
      if (!openedModal) {
        await sleep(1000);
      }
    }

    if (openedModal) {
      await sleep(3500);
    }
  }

  if (!findDialog()) {
    let opened = false;
    for (let attempt = 0; attempt < 10 && !opened; attempt += 1) {
      opened = openFirstEasyApplyCard();
      if (!opened) {
        await sleep(1000);
      }
    }

    if (!opened) {
      return { ok: false, message: 'No Easy Apply jobs found on the current page.' };
    }
    await sleep(2500);
  }

  if (!findDialog()) {
    let openedModal = false;
    for (let attempt = 0; attempt < 8 && !openedModal; attempt += 1) {
      openedModal = openDetailEasyApply();
      if (!openedModal) {
        await sleep(1000);
      }
    }

    if (openedModal) {
      await sleep(3500);
    }
  }

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const dialog = findDialog();
    if (!dialog) {
      break;
    }

    const title = normalizeText(dialog.innerText || '');
    if (/application sent|your application was sent|application submitted/i.test(title)) {
      await setState({ enabled: false, queue: [], index: 0, appliedJobIds: [], lastStatus: 'submitted', updatedAt: Date.now() });
      return { ok: true, message: 'Application submitted.' };
    }

    await processDialog(settings);
    await sleep(3000);
  }

  const finalDialog = findDialog();
  if (finalDialog && /application sent|your application was sent|application submitted/i.test(normalizeText(finalDialog.innerText || ''))) {
    await setState({ enabled: false, queue: [], index: 0, appliedJobIds: [], lastStatus: 'submitted', updatedAt: Date.now() });
    return { ok: true, message: 'Application submitted.' };
  }

  await setState({ enabled: false, queue: [], index: 0, appliedJobIds: [], lastStatus: 'stopped', updatedAt: Date.now() });
  return { ok: true, message: 'Automation reached a non-submission state.' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GMH_START_AUTOMATION') {
    runAutomation()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }
});
