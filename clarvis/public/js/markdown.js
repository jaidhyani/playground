let initialized = false;

export function initMarkdown() {
  if (initialized || typeof marked === 'undefined') return;

  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function(code, lang) {
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (e) {
          console.warn('Highlight error:', e);
        }
      }
      return code;
    }
  });

  initialized = true;
}

export function renderMarkdown(text) {
  if (typeof marked === 'undefined') {
    return escapeHtml(text);
  }

  initMarkdown();

  try {
    return marked.parse(text);
  } catch (e) {
    console.error('Markdown parse error:', e);
    return escapeHtml(text);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
