// background.js - DeepL Page Translator Background Worker

// Listen for message events from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    handleTranslation(message.text, message.sourceLang, message.targetLang)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Perform translation using DeepL API
async function handleTranslation(text, sourceLang, targetLang) {
  // Load settings
  const settings = await new Promise(resolve => {
    chrome.storage.local.get(['apiKey', 'apiType'], resolve);
  });
  
  const apiKey = settings.apiKey;
  const apiType = settings.apiType || 'free';
  
  if (!apiKey) {
    throw new Error('APIキーが設定されていません。拡張機能の設定からAPIキーを入力してください。');
  }
  
  // Choose endpoint
  const endpoint = apiType === 'pro' 
    ? 'https://api.deepl.com/v2/translate' 
    : 'https://api-free.deepl.com/v2/translate';
    
  const body = {
    text: Array.isArray(text) ? text : [text],
    target_lang: targetLang
  };
  
  // Include source language if not 'auto'
  if (sourceLang && sourceLang !== 'auto') {
    body.source_lang = sourceLang;
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `HTTP error! status: ${response.status}`;
      
      if (response.status === 403) {
        throw new Error('APIキーが無効、または認証に失敗しました。');
      } else if (response.status === 456) {
        throw new Error('翻訳上限（リミット）に達しました。');
      } else {
        throw new Error(message);
      }
    }
    
    const data = await response.json();
    if (data.translations && data.translations.length > 0) {
      if (Array.isArray(text)) {
        return {
          success: true,
          translations: data.translations.map(t => t.text),
          detectedSource: data.translations[0].detected_source_language
        };
      } else {
        return {
          success: true,
          translation: data.translations[0].text,
          detectedSource: data.translations[0].detected_source_language
        };
      }
    } else {
      throw new Error('応答フォーマットが不正です。');
    }
  } catch (error) {
    console.error('DeepL API Request failed:', error);
    throw error;
  }
}
