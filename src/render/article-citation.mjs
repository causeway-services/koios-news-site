import { projectCslItem } from '@red-cup-engineering/csl-json-services-section/projection';

// Bibliographic identity is projected from the same accepted article that is
// rendered for readers. A news report stays article-newspaper; no DOI, journal
// registration, peer review or academic indexing is inferred from markup.
const projection = Object.freeze({
  id: 'url', URL: 'url', type: { value: 'article-newspaper' },
  title: 'title', author: { path: 'byline', as: 'names', literal: 'literal' },
  issued: { path: 'published', as: 'date' },
  'container-title': 'publication', publisher: 'publication', language: 'language',
});

export function articleCitation(property, post) {
  return projectCslItem({
    url: new URL(`/posts/${post.slug}/`, property.origin).href,
    title: post.title, byline: [{ literal: post.author }],
    published: post.publishedAt ?? post.date,
    publication: property.name, language: property.locale,
  }, projection);
}
