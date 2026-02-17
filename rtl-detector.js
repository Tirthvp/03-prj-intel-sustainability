/* RTL Detector
   - Detects language changes via HTML `lang` attribute, DOM mutations,
     and simple text-sampling heuristics (RTL Unicode ranges).
   - Applies `dir="rtl"` to the root element when RTL is detected.
   - Exposes `rtlDetector.evaluate()` for manual checks.

   This file intentionally avoids external network calls so it works
   offline. You can optionally integrate a server-side AI language
   detection API by calling your endpoint from `evaluate()`.
*/
(function () {
  'use strict';

  function containsRTL(text) {
    if (!text) return false;
    // Unicode ranges for Hebrew, Arabic, Syriac, Thaana, and presentation forms
    const rtl = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    return rtl.test(text);
  }

  function detectFromLangAttr() {
    const lang = (document.documentElement.getAttribute('lang') || '').trim().toLowerCase();
    if (!lang) return null;
    const code = lang.split('-')[0];
    const rtlLangs = new Set(['ar','he','fa','ur','ps','sd','ug','yi']);
    return rtlLangs.has(code) ? {source: 'langAttr', rtl: true} : {source: 'langAttr', rtl: false};
  }

  function detectFromTextSample() {
    // Grab visible text sample from body
    const maxChars = 400;
    let txt = '';
    try {
      txt = (document.body && document.body.innerText) ? document.body.innerText.trim().slice(0, maxChars) : '';
    } catch (e) {
      txt = '';
    }
    return {source: 'textSample', rtl: containsRTL(txt)};
  }

  function applyDirection(rtl) {
    const html = document.documentElement;
    const current = (html.getAttribute('dir') || '').toLowerCase() || getComputedStyle(html).direction || 'ltr';
    const desired = rtl ? 'rtl' : 'ltr';
    if (current !== desired) {
      html.setAttribute('dir', desired);
      document.body.classList.toggle('is-rtl', rtl);
      console.info('[rtl-detector] set dir="' + desired + '"');
    }
  }

  function evaluate() {
    // 1) Check lang attribute
    const langCheck = detectFromLangAttr();
    if (langCheck && typeof langCheck.rtl === 'boolean') {
      applyDirection(!!langCheck.rtl);
      return langCheck;
    }
    // 2) Fallback to text-sampling
    const textCheck = detectFromTextSample();
    applyDirection(!!textCheck.rtl);
    return textCheck;
  }

  // Observe changes to html[lang], html[dir], body mutations and added nodes
  const observer = new MutationObserver(function (mutations) {
    for (const m of mutations) {
      if (m.type === 'attributes' && (m.target === document.documentElement) && (m.attributeName === 'lang' || m.attributeName === 'dir')) {
        evaluate();
        return;
      }
      if (m.type === 'childList') {
        // Google Translate and other widgets often inject nodes; re-evaluate
        for (const n of m.addedNodes) {
          if (!n || n.nodeType !== 1) continue;
          const id = (n.id || '').toLowerCase();
          const cls = (n.className || '').toLowerCase();
          if (id.includes('goog') || id.includes('translate') || cls.includes('translated')) {
            evaluate();
            return;
          }
        }
      }
    }
  });

  // Start observing
  try {
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang','dir'] });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true });
  } catch (e) {
    // If observe fails (rare), still run evaluate occasionally
    console.warn('[rtl-detector] observer failed, falling back to interval checks', e);
    setInterval(evaluate, 3000);
  }

  // Listen for common translation init event (if present)
  window.addEventListener('googleTranslateElementInit', function () { evaluate(); });

  // Do initial detection as soon as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', evaluate);
  } else {
    evaluate();
  }

  // Expose API
  window.rtlDetector = {
    evaluate: evaluate,
    containsRTL: containsRTL
  };
})();
