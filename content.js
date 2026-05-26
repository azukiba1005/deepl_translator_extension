// content.js - Silent Page Translator Content Script

let isTranslated = false;

// Load configurations
let settings = {
  apiKey: '',
  apiType: 'free',
  targetLang: 'JA',
  autoTranslateEn: false
};

// Fetch current configurations
chrome.storage.local.get(['apiKey', 'apiType', 'targetLang', 'autoTranslateEn'], (result) => {
  settings = { ...settings, ...result };
  
  // Trigger auto-translate if enabled and API key exists
  if (settings.autoTranslateEn && settings.apiKey) {
    setTimeout(() => {
      if (detectIsEnglish()) {
        const nodes = collectTextNodes();
        if (nodes.length > 0) {
          translatePageNodes(nodes, settings.targetLang).catch(err => {
            console.error('Auto-translation failed:', err);
          });
        }
      }
    }, 800); // 800ms delay to allow page nodes to load
  }
});

// Sync changes to settings
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    for (const [key, value] of Object.entries(changes)) {
      if (key in settings) {
        settings[key] = value.newValue;
      }
    }
  }
});

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translatePage') {
    const nodes = collectTextNodes();
    if (nodes.length === 0) {
      sendResponse({ success: false, error: '翻訳可能なテキストが見つかりませんでした。' });
      return;
    }
    
    translatePageNodes(nodes, message.targetLang)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keeps message channel open for async response
  }
  
  else if (message.action === 'revertPage') {
    revertPageNodes();
    sendResponse({ success: true });
  }
  
  else if (message.action === 'getPageTranslationStatus') {
    sendResponse({ isTranslated: isTranslated });
  }
});

// Language detection
function detectIsEnglish() {
  // 1. Check html lang attribute
  const htmlLang = (document.documentElement.lang || '').toLowerCase();
  if (htmlLang.startsWith('en')) return true;
  
  // 2. Check meta tag
  const metaLang = document.querySelector('meta[http-equiv="content-language"]');
  if (metaLang && metaLang.content.toLowerCase().startsWith('en')) return true;
  
  // 3. Heuristic char check
  if (!htmlLang) {
    const sampleNodes = collectTextNodes().slice(0, 10);
    if (sampleNodes.length > 0) {
      let englishChars = 0;
      let totalChars = 0;
      sampleNodes.forEach(node => {
        const val = node.nodeValue.replace(/[\s\d\W]+/g, '');
        totalChars += val.length;
        const matches = val.match(/[A-Za-z]/g);
        if (matches) englishChars += matches.length;
      });
      
      if (totalChars > 30 && (englishChars / totalChars) > 0.85) {
        return true;
      }
    }
  }
  return false;
}

// Crawl visible text nodes
function collectTextNodes() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        const rejectTags = ['script', 'style', 'code', 'pre', 'noscript', 'iframe', 'svg', 'textarea', 'input', 'select'];
        if (rejectTags.includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        const text = node.nodeValue.trim();
        if (!text || /^[\s\d\W]+$/.test(text) || text.length < 2) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Check display visibility
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  return nodes;
}

// Perform translation in silent batches
async function translatePageNodes(nodes, targetLang) {
  let batchText = [];
  let batchNodes = [];
  let charCount = 0;
  
  const maxBatchSize = 35;
  const maxCharCount = 2000;
  
  const sendBatch = async (texts, currentNodes) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'translate',
        text: texts,
        sourceLang: 'auto',
        targetLang: targetLang
      }, (response) => {
        if (response && response.success && response.translations) {
          response.translations.forEach((translationText, idx) => {
            const node = currentNodes[idx];
            if (node && node.parentElement) {
              if (node.deeplOriginal === undefined) {
                node.deeplOriginal = node.nodeValue;
              }
              node.nodeValue = translationText;
            }
          });
          resolve(true);
        } else {
          console.error('Batch translation failed:', response ? response.error : 'Unknown error');
          resolve(false);
        }
      });
    });
  };
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const text = node.nodeValue.trim();
    
    batchText.push(text);
    batchNodes.push(node);
    charCount += text.length;
    
    if (batchText.length >= maxBatchSize || charCount >= maxCharCount || i === nodes.length - 1) {
      const success = await sendBatch(batchText, batchNodes);
      if (!success) {
        throw new Error('APIの翻訳バッチ処理中にエラーが発生しました。');
      }
      
      batchText = [];
      batchNodes = [];
      charCount = 0;
      
      // Small delay to prevent hitting rate limits
      await new Promise(r => setTimeout(r, 120));
    }
  }
  
  isTranslated = true;
}

// Revert translated text
function revertPageNodes() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );
  
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.deeplOriginal !== undefined) {
      node.nodeValue = node.deeplOriginal;
      delete node.deeplOriginal;
    }
  }
  
  isTranslated = false;
}
