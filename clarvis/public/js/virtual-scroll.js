// Virtual scroll helpers for long message lists
// Limits rendered messages to prevent performance issues with 1000+ messages

const MAX_VISIBLE_MESSAGES = 100;

export function getVisibleMessages(messages) {
  if (messages.length <= MAX_VISIBLE_MESSAGES) {
    return { visible: messages, hiddenCount: 0 };
  }

  return {
    visible: messages.slice(-MAX_VISIBLE_MESSAGES),
    hiddenCount: messages.length - MAX_VISIBLE_MESSAGES
  };
}

export function createLoadMoreHandler(container, loadMore) {
  const btn = container.querySelector('.load-more-btn');
  if (btn) {
    btn.addEventListener('click', loadMore);
  }
}

export function renderLoadMoreBanner(hiddenCount) {
  if (hiddenCount === 0) return '';

  return `
    <div class="load-more-banner">
      <span>${hiddenCount} older messages hidden</span>
      <button class="load-more-btn btn-small">Load more</button>
    </div>
  `;
}
