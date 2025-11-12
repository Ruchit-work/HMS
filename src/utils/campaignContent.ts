/**
 * Utility functions for formatting and truncating campaign content
 */

/**
 * Get plain text from HTML (for truncation) - works in browser and server
 */
export function getPlainText(html: string): string {
  if (!html) return ""
  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
    .replace(/&amp;/g, "&") // Replace &amp; with &
    .replace(/&lt;/g, "<") // Replace &lt; with <
    .replace(/&gt;/g, ">") // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim()
}

/**
 * Truncate text to a maximum length at word boundary
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "..."
  }
  return truncated + "..."
}

/**
 * Get first paragraph or first few sentences from HTML content
 */
export function getContentPreview(html: string, maxLength: number = 150): string {
  if (!html) return ""
  
  // Try to extract first paragraph
  // Use [\s\S] instead of . with s flag to match any character including newlines (ES2017 compatible)
  const firstParagraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (firstParagraphMatch) {
    const firstPara = firstParagraphMatch[1]
    const plainText = getPlainText(firstPara)
    if (plainText.length <= maxLength) {
      return `<p>${firstPara}</p>`
    }
    const truncated = truncateText(plainText, maxLength)
    return `<p>${truncated}</p>`
  }
  
  // If no paragraph tags, try to get first sentence or truncate
  const plainText = getPlainText(html)
  if (plainText.length <= maxLength) {
    // Return first sentence if available
    const firstSentence = plainText.match(/^[^.!?]+[.!?]/)
    if (firstSentence && firstSentence[0].length <= maxLength) {
      return `<p>${firstSentence[0]}</p>`
    }
    return html
  }
  
  // Truncate and wrap in paragraph
  const truncated = truncateText(plainText, maxLength)
  return `<p>${truncated}</p>`
}

/**
 * Check if content should be truncated
 */
export function shouldTruncate(html: string, maxLength: number = 150): boolean {
  if (!html) return false
  const plainText = getPlainText(html)
  return plainText.length > maxLength
}

