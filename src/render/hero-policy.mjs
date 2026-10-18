/** Choose the existing deterministic article art when supplied imagery has no truthful text alternative. */
const GENERIC = /^(?:illustration|image|photo|picture)\s+for\b/iu;
export function selectArticleHeroImage(post, sectionTitle, fallbackAlternative) {
  if (!post || typeof post.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(post.slug) ||
      typeof post.title !== 'string' || !post.title.trim() ||
      typeof fallbackAlternative !== 'function') throw new TypeError('valid article and fallback alternative required');
  const suppliedImage = typeof post.image === 'string' && post.image.trim() ? post.image : null;
  const alt = typeof post.imageAlt === 'string' ? post.imageAlt.trim() : '';
  if (suppliedImage && alt && !GENERIC.test(alt)) {
    return Object.freeze({image:suppliedImage,imageAlt:alt,imageCredit:post.imageCredit});
  }
  const generatedAlt = fallbackAlternative({title:post.title,sectionTitle});
  if (typeof generatedAlt !== 'string' || !generatedAlt.trim()) throw new TypeError('fallback alternative missing');
  return Object.freeze({image:`/assets/article-art/${post.slug}.svg`,imageAlt:generatedAlt,imageCredit:undefined});
}
