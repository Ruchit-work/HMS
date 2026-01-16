
function sanitizeHtmlRegex(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  // Allowed tags
  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr']

  // Allowed attributes
  const allowedAttrs = ['href', 'target', 'rel', 'title', 'alt', 'src', 'width', 'height', 'class', 'id', 'style']

  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')

  // Allow only safe tags and attributes using regex
  const tagPattern = new RegExp(`<(/?)([a-z][a-z0-9]*)\\b([^>]*)>`, 'gi')
  sanitized = sanitized.replace(tagPattern, (match, closing, tagName, attrs) => {
    const lowerTag = tagName.toLowerCase()
    
    if (!allowedTags.includes(lowerTag)) {
      return '' // Remove disallowed tags
    }

    if (closing) {
      return `</${lowerTag}>`
    }

    // Filter attributes
    const attrPattern = /(\w+)\s*=\s*["']([^"']*)["']/gi
    const safeAttrs: string[] = []
    let attrMatch
    
    while ((attrMatch = attrPattern.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase()
      const attrValue = attrMatch[2]
      
      if (allowedAttrs.includes(attrName)) {
        // Additional validation for href/src URLs
        if ((attrName === 'href' || attrName === 'src') && attrValue) {
          const safeUrlPattern = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
          if (safeUrlPattern.test(attrValue)) {
            safeAttrs.push(`${attrName}="${attrValue}"`)
          }
        } else {
          safeAttrs.push(`${attrName}="${attrValue}"`)
        }
      }
    }

    return safeAttrs.length > 0 
      ? `<${lowerTag} ${safeAttrs.join(' ')}>`
      : `<${lowerTag}>`
  })

  return sanitized
}


export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  // Use regex-based sanitizer (works on both server and client, avoids jsdom/parse5 issues)
  return sanitizeHtmlRegex(html)
}


export function sanitizeForInnerHTML(html: string): { __html: string } {
  return { __html: sanitizeHtml(html) }
}

