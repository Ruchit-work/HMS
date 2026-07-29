/**
 * Centralized html2pdf.js Engine Service
 * Standard PDF Generation Pipeline for HMS using html2pdf.js exclusively.
 */

export interface Html2PdfOptions {
  margin?: number | [number, number, number, number]
  filename?: string
  image?: { type: string; quality: number }
  html2canvas?: {
    scale?: number
    useCORS?: boolean
    backgroundColor?: string
    letterRendering?: boolean
    scrollX?: number
    scrollY?: number
  }
  jsPDF?: {
    unit?: string
    format?: string
    orientation?: string
    compress?: boolean
  }
  pagebreak?: {
    mode?: string | string[]
    avoid?: string | string[]
    before?: string | string[]
    after?: string | string[]
  }
}

/**
 * Dynamically and safely loads html2pdf.js in browser environment (SSR safe)
 */
export async function getHtml2Pdf(): Promise<any> {
  if (typeof window === "undefined") return null
  const w = window as any
  if (w.html2pdf) return w.html2pdf

  try {
    const mod = await import("html2pdf.js")
    const loaded = (mod as any)?.default ?? mod
    if (typeof loaded === "function") {
      w.html2pdf = loaded
      return loaded
    }
  } catch (err) {
    console.error("Failed to load html2pdf.js:", err)
  }
  return null
}

/**
 * Returns default html2pdf configuration for standard A4 documents
 */
export function getDefaultHtml2PdfOptions(filename = "document.pdf"): Html2PdfOptions {
  return {
    margin: [6, 6, 6, 6],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      letterRendering: true,
      scrollX: 0,
      scrollY: 0,
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: ["tr", "td", ".totals", ".card", ".signature", ".thank-you", ".banner-strip", ".payment-box", ".footer"],
    },
  }
}

/**
 * Synchronizes DOM mounting, font loading, image loading/decoding, and layout reflow.
 * Guarantees that html2pdf / html2canvas captures a fully rendered DOM on the FIRST attempt.
 */
export async function prepareContainerAndAssets(
  html: string,
  targetWidth = "210mm"
): Promise<{ wrapper: HTMLDivElement; element: HTMLElement }> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("DOM preparation is only supported in browser environments")
  }

  const wrapper = document.createElement("div")
  wrapper.style.position = "fixed"
  wrapper.style.left = "-100000px"
  wrapper.style.top = "0"
  wrapper.style.width = targetWidth
  wrapper.style.background = "#ffffff"
  wrapper.style.zIndex = "-9999"
  wrapper.innerHTML = html
  document.body.appendChild(wrapper)

  const element = (wrapper.querySelector("#doc-root") ||
    wrapper.querySelector("#bill-root") ||
    wrapper.firstElementChild ||
    wrapper) as HTMLElement

  // 1. Synchronize font rendering if document.fonts is supported
  if ("fonts" in document && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      // Font load error gracefully ignored
    }
  }

  // 2. Synchronize image loading & decoding for all <img> elements
  const images = Array.from(wrapper.querySelectorAll("img"))
  if (images.length > 0) {
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth !== 0) {
              resolve()
              return
            }

            let settled = false
            const done = () => {
              if (settled) return
              settled = true
              img.removeEventListener("load", done)
              img.removeEventListener("error", done)
              resolve()
            }

            img.addEventListener("load", done)
            img.addEventListener("error", done)

            const timer = setTimeout(done, 2500)

            if ("decode" in img && typeof img.decode === "function") {
              img
                .decode()
                .then(() => {
                  clearTimeout(timer)
                  done()
                })
                .catch(() => {
                  // Fall back to event listeners
                })
            }
          })
      )
    )
  }

  // 3. Wait for layout reflow & paint cycle using double requestAnimationFrame
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })

  return { wrapper, element }
}

/**
 * Renders HTML string into a PDF Blob via html2pdf.js after full asset synchronization
 */
export async function renderHTMLToPdfBlob(
  html: string,
  options?: Html2PdfOptions
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering is only supported in browser environments")
  }

  const html2pdf = await getHtml2Pdf()
  if (!html2pdf) throw new Error("html2pdf.js library is unavailable")

  const opts = options || getDefaultHtml2PdfOptions()
  const { wrapper, element } = await prepareContainerAndAssets(html)

  try {
    const pdfBlob = (await html2pdf().set(opts).from(element).outputPdf("blob")) as Blob
    return pdfBlob
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
    }
  }
}

/**
 * Renders HTML string to PDF and triggers a browser download after asset synchronization
 */
export async function renderHTMLToPdfDownload(
  html: string,
  filename = "document.pdf",
  options?: Html2PdfOptions
): Promise<void> {
  if (typeof window === "undefined") return

  const html2pdf = await getHtml2Pdf()
  if (!html2pdf) throw new Error("html2pdf.js library is unavailable")

  const opts = { ...getDefaultHtml2PdfOptions(filename), ...options }
  const { wrapper, element } = await prepareContainerAndAssets(html)

  try {
    await html2pdf().set(opts).from(element).save()
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
    }
  }
}

/**
 * Renders HTML string to PDF and opens in a new tab (or downloads if popup blocked)
 */
export async function renderHTMLToPdfOpen(
  html: string,
  filename = "document.pdf",
  options?: Html2PdfOptions
): Promise<void> {
  if (typeof window === "undefined") return

  const opts = { ...getDefaultHtml2PdfOptions(filename), ...options }

  try {
    const blob = await renderHTMLToPdfBlob(html, opts)
    const blobUrl = URL.createObjectURL(blob)
    const win = window.open(blobUrl, "_blank")
    if (!win) {
      await renderHTMLToPdfDownload(html, filename, opts)
    }
  } catch (err) {
    console.error("PDF opening failed, falling back to download:", err)
    await renderHTMLToPdfDownload(html, filename, opts)
  }
}
