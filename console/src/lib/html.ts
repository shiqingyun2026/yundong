const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'ul'
])

const URL_ATTRS = new Set(['href', 'src'])
const GLOBAL_ATTRS = new Set(['class'])
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title'])
}

const SAFE_URL_PATTERN = /^(https?:|data:image\/)/i

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const sanitizeAttributeValue = (name: string, value: string) => {
  const normalized = value.trim()

  if (URL_ATTRS.has(name) && normalized && !SAFE_URL_PATTERN.test(normalized)) {
    return ''
  }

  if (name === 'target') {
    return normalized === '_blank' ? '_blank' : ''
  }

  if (name === 'rel') {
    return 'noopener noreferrer'
  }

  return normalized
}

export function sanitizeRichHtml(html: string) {
  if (!html || typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html || ''
  }

  const parser = new DOMParser()
  const document = parser.parseFromString(html, 'text/html')

  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || '')
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return ''
    }

    const element = node as HTMLElement
    const tagName = element.tagName.toLowerCase()

    if (!ALLOWED_TAGS.has(tagName)) {
      return Array.from(element.childNodes)
        .map(child => sanitizeNode(child))
        .join('')
    }

    const allowedAttrs = new Set([...(TAG_ATTRS[tagName] || []), ...GLOBAL_ATTRS])
    const attrs = Array.from(element.attributes)
      .filter(attribute => allowedAttrs.has(attribute.name.toLowerCase()))
      .map(attribute => {
        const name = attribute.name.toLowerCase()
        const safeValue = sanitizeAttributeValue(name, attribute.value)

        if (!safeValue) {
          return ''
        }

        return ` ${name}="${escapeHtml(safeValue)}"`
      })
      .join('')

    const content = Array.from(element.childNodes)
      .map(child => sanitizeNode(child))
      .join('')

    if (tagName === 'img' || tagName === 'br' || tagName === 'hr') {
      return `<${tagName}${attrs}>`
    }

    const extraAttrs = tagName === 'a' ? ' rel="noopener noreferrer"' : ''
    return `<${tagName}${attrs}${tagName === 'a' && !attrs.includes(' rel=') ? extraAttrs : ''}>${content}</${tagName}>`
  }

  return Array.from(document.body.childNodes)
    .map(child => sanitizeNode(child))
    .join('')
}
