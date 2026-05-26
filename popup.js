// popup.js - DeepL Page Translator Toolbar Dashboard

// DOM Elements - Navigation
const btnToggleSettings = document.getElementById('btn-toggle-settings');
const btnGoSettings = document.getElementById('btn-go-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnBackTranslator = document.getElementById('btn-back-translator');
const viewTranslator = document.getElementById('view-translator');
const viewSettings = document.getElementById('view-settings');

// DOM Elements - Main controls
const selectTargetLang = document.getElementById('select-target-lang');
const btnTranslatePage = document.getElementById('btn-translate-page');
const btnRevertPage = document.getElementById('btn-revert-page');
const apiStatusWarning = document.getElementById('api-status-warning');

// DOM Elements - Settings
const apiKeyInput = document.getElementById('api-key-input');
const btnTogglePassword = document.getElementById('btn-toggle-password');
const eyeIcon = document.getElementById('eye-icon');
const apiTypeFree = document.getElementById('api-type-free');
const apiTypePro = document.getElementById('api-type-pro');
const settingAutoTranslate = document.getElementById('setting-auto-translate');
const settingTheme = document.getElementById('setting-theme');

// DOM Elements - Toast
const toast = document.getElementById('toast');

// Default Settings
const defaultSettings = {
  apiKey: '',
  apiType: 'free',
  targetLang: 'JA',
  autoTranslateEn: false,
  theme: 'system'
};

// Current loaded settings
let currentSettings = { ...defaultSettings };

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  applyTheme(currentSettings.theme);
  checkApiStatus();
  
  // Check active tab page translation status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getPageTranslationStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          // Suppress error when content script is not loaded on current tab (e.g. system page)
          return;
        }
        if (response && response.isTranslated) {
          btnRevertPage.disabled = false;
        }
      });
    }
  });
});

// Load Settings from Chrome Storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(Object.keys(defaultSettings), (result) => {
      currentSettings = { ...defaultSettings, ...result };
      
      // Update UI elements in Translator
      selectTargetLang.value = currentSettings.targetLang;
      
      // Update UI elements in Settings Panel
      apiKeyInput.value = currentSettings.apiKey;
      if (currentSettings.apiType === 'pro') {
        apiTypePro.checked = true;
      } else {
        apiTypeFree.checked = true;
      }
      settingAutoTranslate.checked = currentSettings.autoTranslateEn || false;
      settingTheme.value = currentSettings.theme;
      
      resolve();
    });
  });
}

// Check API key configuration and show warning if needed
function checkApiStatus() {
  if (!currentSettings.apiKey) {
    apiStatusWarning.classList.remove('hidden');
    btnTranslatePage.disabled = true;
  } else {
    apiStatusWarning.classList.add('hidden');
    btnTranslatePage.disabled = false;
  }
}

// Show toast notification
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2000);
}

// Setup all DOM event listeners
function setupEventListeners() {
  // Navigation
  btnToggleSettings.addEventListener('click', () => showView('settings'));
  btnGoSettings.addEventListener('click', () => showView('settings'));
  btnBackTranslator.addEventListener('click', () => showView('translator'));
  
  // Settings View: Save Settings
  btnSaveSettings.addEventListener('click', async () => {
    const newSettings = {
      apiKey: apiKeyInput.value.trim(),
      apiType: apiTypeFree.checked ? 'free' : 'pro',
      autoTranslateEn: settingAutoTranslate.checked,
      theme: settingTheme.value,
      targetLang: selectTargetLang.value
    };
    
    // Save to storage
    chrome.storage.local.set(newSettings, () => {
      currentSettings = { ...currentSettings, ...newSettings };
      applyTheme(currentSettings.theme);
      checkApiStatus();
      
      showToast('設定を保存しました');
      showView('translator');
    });
  });
  
  // Settings View: Toggle password visibility
  btnTogglePassword.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      `;
    } else {
      apiKeyInput.type = 'password';
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `;
    }
  });
  
  // Language selector change
  selectTargetLang.addEventListener('change', () => {
    chrome.storage.local.set({ targetLang: selectTargetLang.value });
  });
  
  // Page Translation Actions
  btnTranslatePage.addEventListener('click', () => {
    if (!currentSettings.apiKey) {
      showToast('設定からAPIキーを登録してください');
      return;
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      btnTranslatePage.disabled = true;
      btnTranslatePage.textContent = '翻訳開始中...';
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'translatePage',
        targetLang: selectTargetLang.value
      }, (response) => {
        btnTranslatePage.disabled = false;
        btnTranslatePage.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;">
            <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9"></path>
          </svg>
          このページを翻訳
        `;
        
        if (chrome.runtime.lastError) {
          showToast('非対応ページです。再読み込みするか別サイトでお試しください。');
          return;
        }
        
        if (response && response.success) {
          btnRevertPage.disabled = false;
          showToast('ページ翻訳を開始しました');
          setTimeout(() => window.close(), 800);
        } else {
          const err = response ? response.error : '翻訳開始エラー';
          showToast(`エラー: ${err}`);
        }
      });
    });
  });

  btnRevertPage.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'revertPage' }, (response) => {
        if (chrome.runtime.lastError) {
          showToast('元に戻せませんでした。ページを再読み込みしてください。');
          return;
        }
        if (response && response.success) {
          btnRevertPage.disabled = true;
          showToast('元の表示に戻しました');
          setTimeout(() => window.close(), 800);
        }
      });
    });
  });
}

// Toggle between Translator and Settings views
function showView(viewName) {
  if (viewName === 'settings') {
    viewTranslator.classList.remove('active');
    viewSettings.classList.add('active');
    btnToggleSettings.style.visibility = 'hidden';
  } else {
    viewSettings.classList.remove('active');
    viewTranslator.classList.add('active');
    btnToggleSettings.style.visibility = 'visible';
  }
}

// Apply Theme
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
