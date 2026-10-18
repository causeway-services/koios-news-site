/** Public reporting is searched locally. No query leaves the browser. */
export function buildSearchIndex(posts) {
  return {
    kind: 'news-property.search-index/v2',
    items: posts.map(post => ({
      slug: post.slug, title: post.title, description: post.description,
      section: post.section, sectionTitle: post.sectionTitle, tags: post.tags ?? [],
      date: post.publishedAt ?? post.date, url: `/posts/${post.slug}/`,
      text: (post.body ?? '').replace(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1')
        .replace(/[`*#_]/gu, '').replace(/\s+/gu, ' ').trim(),
    })),
  };
}

export function searchClientScript() {
  return `(${searchClient.toString()})();`;
}

function searchClient() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-q');
  const section = document.getElementById('search-section');
  const sort = document.getElementById('search-sort');
  const results = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  let index = null, timer;
  const normalized = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function restore() {
    const params = new URLSearchParams(location.search);
    input.value = params.get('q') ?? '';
    section.value = params.get('section') ?? '';
    sort.value = params.get('sort') === 'newest' ? 'newest' : 'relevance';
  }
  function search(save = true) {
    if (!index) return;
    const terms = normalized(input.value.trim()).split(/\s+/).filter(Boolean);
    if (save) {
      const params = new URLSearchParams();
      if (input.value.trim()) params.set('q', input.value.trim());
      if (section.value) params.set('section', section.value);
      if (sort.value === 'newest') params.set('sort', 'newest');
      history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''));
    }
    const matches = index.items.filter(item => !section.value || item.section === section.value).map(item => {
      const title = normalized(item.title), description = normalized(item.description);
      const tags = normalized(item.tags.join(' ')), text = normalized(item.text);
      const haystack = title + ' ' + description + ' ' + tags + ' ' + text;
      if (!terms.every(term => haystack.includes(term))) return null;
      const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0)
        + (tags.includes(term) ? 4 : 0) + (description.includes(term) ? 2 : 0), 0);
      return {item, score};
    }).filter(Boolean).sort((a, b) => (sort.value === 'newest' ? 0 : b.score - a.score)
      || b.item.date.localeCompare(a.item.date) || a.item.slug.localeCompare(b.item.slug));
    results.replaceChildren();
    for (const {item} of matches) {
      const li = document.createElement('li'), heading = document.createElement('h2');
      const link = document.createElement('a'), meta = document.createElement('p');
      link.href = item.url; link.textContent = item.title; heading.append(link);
      meta.className = 'search-result__meta';
      meta.textContent = (item.sectionTitle || item.section) + ' · ' + item.date.slice(0, 10);
      const excerpt = document.createElement('p');
      const position = terms.length ? normalized(item.text).indexOf(terms[0]) : -1;
      const start = Math.max(0, position - 65);
      excerpt.textContent = position >= 0 ? (start ? '…' : '') + item.text.slice(start, start + 240)
        + (start + 240 < item.text.length ? '…' : '') : item.description;
      li.append(meta, heading, excerpt); results.append(li);
    }
    status.textContent = matches.length ? matches.length + (matches.length === 1 ? ' report' : ' reports')
      : 'No reports match. Try fewer words or a different news desk.';
  }
  restore();
  fetch('/search.json').then(response => {
    if (!response.ok) throw new Error('Search unavailable');
    return response.json();
  }).then(data => { index = data; search(false); })
    .catch(() => { status.textContent = 'Search is unavailable. Browse the archive or news desks.'; });
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); search(); });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 150); });
  section.addEventListener('change', () => search());
  sort.addEventListener('change', () => search());
  window.addEventListener('popstate', () => { restore(); search(false); });
}
