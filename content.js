const STORAGE_KEYS = {
  settings: 'gmhLinkedInSettings',
  state: 'gmhLinkedInState',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let runnerActive = false;
let stopRequested = false;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function extractJobIdFromHref(href) {
  const match = String(href || '').match(/\/jobs\/view\/(\d+)/i);
  return match ? match[1] : '';
}

function isVisible(element) {
  if (!element) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findDialog() {
  return document.querySelector('[role="dialog"], .artdeco-modal');
}

function getButtonText(button) {
  return normalizeText(button?.innerText || button?.getAttribute('aria-label') || button?.textContent || '');
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

async function getSettings() {
  const items = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return items[STORAGE_KEYS.settings] || {};
}

async function getState() {
  const items = await chrome.storage.local.get(STORAGE_KEYS.state);
  return items[STORAGE_KEYS.state] || {
    enabled: false,
    queue: [],
    index: 0,
    appliedJobIds: [],
    seenJobIds: [],
    lastStatus: 'idle',
    updatedAt: Date.now(),
  };
}

async function setState(nextState) {
  await chrome.storage.local.set({ [STORAGE_KEYS.state]: nextState });
}

function getKeywords(settings) {
  const source = normalizeText(settings.cvKeywords || '');
  const fallback = [
    'cyber security',
    'security engineer',
    'application security',
    'devsecops',
    'soc',
    'threat intelligence',
    'network security',
    'cloud security',
  ];

  const keywords = source
    .split(',')
    .map((item) => normalizeLower(item))
    .filter(Boolean);

  return keywords.length > 0 ? keywords : fallback;
}

function collectCandidates(settings, state) {
  const keywords = getKeywords(settings);
  const cards = Array.from(document.querySelectorAll('li.scaffold-layout__list-item, .job-card-container'));
  const applied = new Set((state.appliedJobIds || []).map((item) => String(item)));
  const seen = new Set((state.seenJobIds || []).map((item) => String(item)));

  const candidates = cards.map((card) => {
    const text = normalizeLower(card.innerText || '');
    const links = Array.from(card.querySelectorAll('a[href*="/jobs/view/"]'));
    const href = links[0]?.href || '';
    const idFromHref = extractJobIdFromHref(href);
    const idFromAttr = card.getAttribute('data-occludable-job-id') || card.getAttribute('data-job-id') || '';
    const jobId = String(idFromHref || idFromAttr || href || text.slice(0, 80));

    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.split(' ').length > 1 ? 3 : 1;
      }
    }

    if (/easy apply/.test(text)) {
      score += 2;
    }

    return {
      jobId,
      score,
      card,
      text,
    };
  }).filter((candidate) => candidate.score > 0 && !applied.has(candidate.jobId) && !seen.has(candidate.jobId));

  candidates.sort((left, right) => right.score - left.score);
  return candidates;
}

function clickCandidate(candidate) {
  candidate.card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

function openDetailEasyApply() {
  const detailSelectors = [
    '.jobs-search__job-details--wrapper',
    '.jobs-details',
    '.jobs-unified-top-card',
    'main',
    'body',
  ];

  for (const selector of detailSelectors) {
    const root = document.querySelector(selector);
    if (!root) {
      continue;
    }

    const target = Array.from(root.querySelectorAll('button, a, [role="button"]')).find((candidate) => {
      const text = normalizeLower(getButtonText(candidate));
      return isVisible(candidate)
        && (text === 'easy apply' || text.startsWith('easy apply to'))
        && !text.includes('filter');
    });

    if (target) {
      target.click();
      return true;
    }
  }

  return false;
}

function clickDialogButton(dialog, patterns) {
  const buttons = Array.from(dialog.querySelectorAll('button, a, [role="button"]'));
  const button = buttons.find((candidate) => {
    const text = normalizeLower(getButtonText(candidate));
    return patterns.some((pattern) => pattern.test(text));
  });

  if (!button) {
    return false;
  }

  button.click();
  return true;
}

function selectOptionByHints(selectElement, hints) {
  const normalizedHints = hints.map((hint) => normalizeLower(hint));
  const option = Array.from(selectElement.options).find((candidate) => {
    const text = normalizeLower(candidate.textContent);
    const value = normalizeLower(candidate.value);
    return normalizedHints.some((hint) => text.includes(hint) || value.includes(hint));
  });

  if (!option) {
    return false;
  }

  setNativeValue(selectElement, option.value);
  return true;
}

function fillInputs(root, settings) {
  const controls = Array.from(root.querySelectorAll('input, textarea, select'));

  for (const control of controls) {
    const label = normalizeLower([
      control.labels?.[0]?.innerText,
      control.getAttribute('aria-label'),
      control.getAttribute('placeholder'),
      control.closest('label, .fb-dash-form-element, .artdeco-form__section')?.innerText,
    ].filter(Boolean).join(' '));

    if (!label) {
      continue;
    }

    if (control.tagName === 'SELECT') {
      if (/phone country code|country code/.test(label)) {
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

    if (/full name|name/.test(label) && !control.value) {
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

    if ((control.type === 'number' || /years|experience/.test(label)) && !control.value) {
      setNativeValue(control, settings.yearsExperience || '3');
    }
  }
}

function inferAnswer(questionText, settings) {
  const text = normalizeLower(questionText);

  if (/right to work|work authorization|authorized to work|visa sponsorship|sponsorship/.test(text)) {
    if (/sponsorship/.test(text)) {
      return settings.sponsorshipRequired ? 'yes' : 'no';
    }
    return settings.workAuthorized ? 'yes' : 'no';
  }

  if (/hybrid/.test(text)) {
    return settings.hybridOk ? 'yes' : 'no';
  }

  if (/open source/.test(text)) {
    return settings.openSourceContribution ? 'yes' : 'no';
  }

  if (/currently in a security architecture role/.test(text)) {
    return 'no';
  }

  if (/technical security architecture services|threat modelling|risk assessments|secure blueprints/.test(text)) {
    return 'yes';
  }

  if (/azure and microsoft 365|microsoft 365|azure/.test(text)) {
    return 'no';
  }

  if (/industry frameworks|nist|cis|iso 27001|cyber essentials|ncsc caf/.test(text)) {
    return 'no';
  }

  if (/ms certifications|sc-100|sc-900|az-900|az-104|az-305/.test(text)) {
    return 'no';
  }

  if (/client facing consulting/.test(text)) {
    return 'yes';
  }

  if (/continuously lived in the uk|5\+ years/.test(text)) {
    return 'yes';
  }

  return 'no';
}

function fillQuestionnaires(root, settings) {
  const groups = Array.from(root.querySelectorAll('fieldset, [role="radiogroup"], .fb-dash-form-element, .artdeco-form__section'));

  for (const group of groups) {
    const text = normalizeText(group.innerText || '');
    if (!text) {
      continue;
    }

    const answer = inferAnswer(text, settings);
    const radios = Array.from(group.querySelectorAll('input[type="radio"]'));
    if (radios.length > 0) {
      const radio = radios.find((candidate) => {
        const label = normalizeLower(candidate.closest('label')?.innerText || candidate.parentElement?.innerText || candidate.value);
        return label.includes(answer);
      });
      if (radio) {
        radio.click();
      }
      continue;
    }

    const select = group.querySelector('select');
    if (select && /select an option/i.test(String(select.value || ''))) {
      const option = Array.from(select.options).find((candidate) => normalizeLower(candidate.textContent) === answer)
        || Array.from(select.options).find((candidate) => normalizeLower(candidate.textContent).includes(answer));
      if (option) {
        setNativeValue(select, option.value);
      }
    }
  }
}

function attachResume(root, settings) {
  const input = Array.from(root.querySelectorAll('input[type="file"]')).find((candidate) => isVisible(candidate) || candidate.closest('[role="dialog"]'));
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

  const file = new File([bytes], settings.resumeName || 'resume.pdf', {
    type: match[1] || settings.resumeMimeType || 'application/pdf',
  });

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function isSubmittedText(text) {
  return /your application was sent|application submitted|application sent/i.test(normalizeLower(text));
}

async function closePostApplyDialog() {
  const dialog = findDialog();
  if (!dialog) {
    return;
  }

  clickDialogButton(dialog, [/^not now$/i, /^dismiss$/i, /^close$/i]);
  await sleep(600);
}

async function processApplicationFlow(settings) {
  for (let step = 0; step < 20; step += 1) {
    if (stopRequested) {
      return { status: 'stopped' };
    }

    const dialog = findDialog();
    if (!dialog) {
      return { status: 'no-dialog' };
    }

    const text = normalizeText(dialog.innerText || '');
    if (isSubmittedText(text)) {
      await closePostApplyDialog();
      return { status: 'submitted' };
    }

    attachResume(dialog, settings);
    fillInputs(dialog, settings);
    fillQuestionnaires(dialog, settings);

    const clicked = clickDialogButton(dialog, [
      /^submit application$/i,
      /^submit$/i,
      /^review$/i,
      /^next$/i,
      /^continue$/i,
    ]);

    if (!clicked) {
      return { status: 'blocked' };
    }

    await sleep(1800);
  }

  return { status: 'timed-out' };
}

function goToNextPage() {
  const next = Array.from(document.querySelectorAll('button, a, [role="button"]')).find((candidate) => {
    const text = normalizeLower(getButtonText(candidate));
    const disabled = candidate.getAttribute('disabled') !== null || candidate.getAttribute('aria-disabled') === 'true';
    return !disabled && (text === 'next' || text.startsWith('next '));
  });

  if (!next) {
    return false;
  }

  next.click();
  return true;
}

async function markSeen(state, jobId) {
  const seen = new Set((state.seenJobIds || []).map((item) => String(item)));
  seen.add(String(jobId));
  const next = {
    ...state,
    seenJobIds: Array.from(seen).slice(-2000),
    updatedAt: Date.now(),
  };
  await setState(next);
  return next;
}

async function markApplied(state, jobId) {
  const applied = new Set((state.appliedJobIds || []).map((item) => String(item)));
  applied.add(String(jobId));
  const next = {
    ...state,
    appliedJobIds: Array.from(applied).slice(-5000),
    seenJobIds: Array.from(new Set([...(state.seenJobIds || []), String(jobId)])).slice(-2000),
    lastStatus: 'submitted',
    updatedAt: Date.now(),
  };
  await setState(next);
  return next;
}

async function continuousLoop(settings) {
  while (!stopRequested) {
    const state = await getState();
    if (!state.enabled) {
      return { ok: true, message: 'Automation stopped.' };
    }

    const candidates = collectCandidates(settings, state);
    if (candidates.length === 0) {
      const moved = goToNextPage();
      if (!moved) {
        await setState({ ...state, enabled: false, lastStatus: 'done', updatedAt: Date.now() });
        return { ok: true, message: 'No more matching Easy Apply jobs found.' };
      }
      await sleep(3500);
      continue;
    }

    let handledAny = false;

    for (const candidate of candidates) {
      if (stopRequested) {
        break;
      }

      let liveState = await getState();
      if (!liveState.enabled) {
        return { ok: true, message: 'Automation stopped.' };
      }

      liveState = await markSeen(liveState, candidate.jobId);
      clickCandidate(candidate);
      await sleep(1800);

      if (!findDialog()) {
        let opened = false;
        for (let attempt = 0; attempt < 6 && !opened; attempt += 1) {
          opened = openDetailEasyApply();
          if (!opened) {
            await sleep(800);
          }
        }
      }

      if (!findDialog()) {
        continue;
      }

      const result = await processApplicationFlow(settings);
      if (result.status === 'submitted') {
        liveState = await getState();
        await markApplied(liveState, candidate.jobId);
        handledAny = true;
      }

      await sleep(1200);
    }

    if (!handledAny) {
      const moved = goToNextPage();
      if (!moved) {
        const stateNow = await getState();
        await setState({ ...stateNow, enabled: false, lastStatus: 'done', updatedAt: Date.now() });
        return { ok: true, message: 'Reached end of matching jobs.' };
      }
      await sleep(3500);
    }
  }

  const state = await getState();
  await setState({ ...state, enabled: false, lastStatus: 'stopped', updatedAt: Date.now() });
  return { ok: true, message: 'Automation stopped.' };
}

async function startAutomation() {
  if (runnerActive) {
    const state = await getState();
    if (state.enabled) {
      return { ok: true, message: 'Automation already running. Press Stop to end it.' };
    }
  }

  stopRequested = false;
  const currentState = await getState();
  await setState({
    ...currentState,
    enabled: true,
    lastStatus: 'running',
    updatedAt: Date.now(),
  });

  runnerActive = true;
  const settings = await getSettings();

  continuousLoop(settings)
    .catch(async () => {
      const state = await getState();
      await setState({ ...state, enabled: false, lastStatus: 'error', updatedAt: Date.now() });
    })
    .finally(() => {
      runnerActive = false;
      stopRequested = false;
    });

  return { ok: true, message: 'Continuous automation started. It will keep applying until stopped.' };
}

async function stopAutomation() {
  stopRequested = true;
  const state = await getState();
  await setState({ ...state, enabled: false, lastStatus: 'stopping', updatedAt: Date.now() });
  return { ok: true, message: 'Stop requested. Finishing the current step and halting.' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GMH_START_AUTOMATION') {
    startAutomation()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message?.type === 'GMH_STOP_AUTOMATION') {
    stopAutomation()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  return false;
});

(async () => {
  const state = await getState();
  if (state.enabled && !runnerActive) {
    startAutomation().catch(() => {});
  }
})();
