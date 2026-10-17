// Every record stays readable when JavaScript is unavailable.
const search = document.querySelector<HTMLInputElement>('#search')!;
const form = document.querySelector<HTMLFormElement>('.search-form')!;
const buttons = [
  ...document.querySelectorAll<HTMLButtonElement>('.topic-filters button'),
];
const records = [
  ...document.querySelectorAll<HTMLAnchorElement>('[data-record]'),
];
const count = document.querySelector<HTMLElement>('#result-count')!;
const empty = document.querySelector<HTMLElement>('#empty-state')!;
let topic = '';

function render() {
  const words = search.value
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  let visible = 0;
  for (const record of records) {
    record.hidden =
      (topic !== '' && record.dataset.topic !== topic) ||
      !words.every((word) => record.dataset.search!.includes(word));
    if (!record.hidden) visible++;
  }
  for (const button of buttons)
    button.setAttribute('aria-pressed', String(button.dataset.topic === topic));
  count.textContent = `${visible} ${visible === 1 ? 'decision' : 'decisions'}`;
  empty.hidden = visible !== 0;
  const url = new URL(location.href);
  if (search.value.trim()) url.searchParams.set('q', search.value.trim());
  else url.searchParams.delete('q');
  if (topic) url.searchParams.set('topic', topic);
  else url.searchParams.delete('topic');
  history.replaceState(null, '', url);
}

function restore() {
  const params = new URLSearchParams(location.search);
  search.value = params.get('q') ?? '';
  const requestedTopic = params.get('topic') ?? '';
  topic = buttons.some((button) => button.dataset.topic === requestedTopic)
    ? requestedTopic
    : '';
  render();
}

search.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('reset', (event) => {
  event.preventDefault();
  search.value = '';
  render();
  search.focus();
});
for (const button of buttons)
  button.addEventListener('click', () => {
    topic = button.dataset.topic!;
    render();
  });
document.querySelector('#reset-filters')!.addEventListener('click', () => {
  topic = '';
  search.value = '';
  render();
  search.focus();
});
window.addEventListener('popstate', restore);
restore();
