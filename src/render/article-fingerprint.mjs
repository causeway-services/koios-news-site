/** One article record produces its inspectable facts and matching SVG/PNG marks. */
import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import { socialPaletteFor } from "./social-palette.mjs";

const WIDTH = 1200;
const HEIGHT = 675;
const CELL = 40;
const TOP = 45;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const pattern = (bytes, col, row, colorCount) => {
  const position = row * 30 + col;
  return (bytes[position % bytes.length] ^ bytes[(position * 13 + row) % bytes.length]) % colorCount;
};

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

/** Encode 8-bit RGB pixels, `colorAt(x, y)` supplying each one, as a PNG. */
function encodePng(width, height, colorAt) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const offset = y * (stride + 1) + 1;
    for (let x = 0; x < width; x += 1) colorAt(x, y).copy(raw, offset + x * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * The 1200x675 digest-grid mark, or a vertical window of it: `crop` selects
 * `width` columns of pixels starting at `x0`, so the 4x3 and 1x1 crops are the
 * same picture framed for those aspect ratios, not a different drawing.
 */
function png(bytes, colors, crop = { x0: 0, width: WIDTH }) {
  const rgb = colors.map((color) => Buffer.from(color.slice(1), "hex"));
  return encodePng(crop.width, HEIGHT, (x, y) => (y < TOP || y >= TOP + 15 * CELL ? rgb[2]
    : rgb[pattern(bytes, Math.floor((x + crop.x0) / CELL), Math.floor((y - TOP) / CELL), colors.length)]));
}

/** The aspect-ratio crops of the 1200x675 mark that structured data offers to search engines. */
export const FINGERPRINT_CROPS = Object.freeze([
  Object.freeze({ ratio: "1x1", x0: 262, width: 675, height: HEIGHT }),
  Object.freeze({ ratio: "4x3", x0: 150, width: 900, height: HEIGHT }),
  Object.freeze({ ratio: "16x9", x0: 0, width: WIDTH, height: HEIGHT }),
]);

const LOGO_SIZE = 512;
const LOGO_CELL = 40;
const LOGO_MARGIN = (LOGO_SIZE - 12 * LOGO_CELL) / 2;

/**
 * The publisher logo as a raster: a square 512x512 mark drawn from the same
 * brand digest and palette as `og.png`. Search engines read the publisher
 * logo from structured data and do not accept an SVG there.
 */
export function renderBrandLogoPng(property) {
  const bytes = Buffer.from(sha256(`${property.name}\n${property.tagline ?? ""}`), "hex");
  const colors = socialPaletteFor(property);
  const rgb = colors.map((color) => Buffer.from(color.slice(1), "hex"));
  const inside = (value) => value >= LOGO_MARGIN && value < LOGO_SIZE - LOGO_MARGIN;
  return encodePng(LOGO_SIZE, LOGO_SIZE, (x, y) => (inside(x) && inside(y)
    ? rgb[pattern(bytes, Math.floor((x - LOGO_MARGIN) / LOGO_CELL), Math.floor((y - LOGO_MARGIN) / LOGO_CELL), colors.length)] : rgb[2]));
}

export const LOGO_DIMENSIONS = Object.freeze({ width: LOGO_SIZE, height: LOGO_SIZE });

export function renderBrandPng(property) {
  return png(Buffer.from(sha256(`${property.name}\n${property.tagline ?? ""}`), "hex"), socialPaletteFor(property));
}

function svg(bytes, colors) {
  const cells = Array.from({ length: 15 * 30 }, (_, position) => {
    const col = position % 30;
    const row = Math.floor(position / 30);
    return `<rect x="${col * CELL}" y="${TOP + row * CELL}" width="${CELL}" height="${CELL}" fill="${colors[pattern(bytes, col, row, colors.length)]}"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
<title id="title">Koios.News article fingerprint</title><desc id="desc">Article-specific geometric mark derived from the accompanying facts record.</desc>
<rect width="${WIDTH}" height="${HEIGHT}" fill="${colors[2]}"/>${cells}</svg>
`;
}

export function renderArticleFingerprint(post, property) {
  const facts = {
    kind: "producing-content.article-fingerprint.facts", slug: post.slug,
    url: new URL(`/posts/${post.slug}`, property.origin).href, headline: post.title,
    summary: post.description,
    datePublished: post.publishedPrecision === "instant" ? post.publishedInstant : post.publishedAt ?? post.date,
    author: post.author, section: post.sectionTitle, keywords: post.keywords,
    tags: post.tags, references: post.referenceRecords.map((reference) => reference.url),
    ...(post.license ? { license: post.license } : {}),
    ...(post.licenseUrl ? { licenseUrl: post.licenseUrl } : {}),
    ...(post.syndicationRights ? { syndicationRights: post.syndicationRights } : {}),
    wordCount: post.body.trim().split(/\s+/u).length, bodySha256: sha256(post.body),
    sourceSha256: post.sourceDigest, correctionCount: post.corrections.length,
    correctionState: post.corrections.length ? "corrected" : "current",
  };
  const serialization = JSON.stringify(stable(facts));
  const hash = sha256(serialization);
  const base = `fingerprints/${post.slug}`;
  const carrier = { kind: "producing-content.article-fingerprint", facts, serialization, sha256: hash,
    encoding: { serialization: "producing-content.stable-json.v1", digest: "sha256",
      visible: "koios.digest-grid.v1", metadata: "none" },
    jsonUrl: `/${base}.json`, svgUrl: `/${base}.svg`, pngUrl: `/${base}.png` };
  const bytes = Buffer.from(hash, "hex");
  const palette = socialPaletteFor(property);
  const files = new Map([[ `${base}.json`, `${JSON.stringify(carrier)}\n` ],
    [ `${base}.svg`, svg(bytes, palette) ], [ `${base}.png`, png(bytes, palette) ]]);
  // Content-addressed copies: the URL changes whenever the bytes do, so the
  // edge may cache them forever. The legacy names above stay for old links.
  for (const crop of FINGERPRINT_CROPS) {
    const image = png(bytes, palette, crop);
    files.set(`fingerprints/h/${post.slug}.${sha256(image).slice(0, 16)}.${crop.ratio}.png`, image);
  }
  return files;
}

/**
 * The hashed 1x1, 4x3 and 16x9 crops among an article's fingerprint files, as
 * `ImageObject` inputs for structured data.
 * @param {Map<string,string|Buffer>} files the result of `renderArticleFingerprint`
 * @param {string} slug
 * @param {string} origin
 * @returns {{url:string,width:number,height:number,ratio:string}[]}
 */
export function fingerprintCropImages(files, slug, origin) {
  return FINGERPRINT_CROPS.flatMap((crop) => {
    const path = [...files.keys()].find((key) => key.startsWith(`fingerprints/h/${slug}.`) && key.endsWith(`.${crop.ratio}.png`));
    return path === undefined ? [] : [{ url: new URL(`/${path}`, origin).toString(), width: crop.width, height: crop.height, ratio: crop.ratio }];
  });
}
