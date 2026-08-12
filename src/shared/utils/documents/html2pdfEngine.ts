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
    windowWidth?: number
    windowHeight?: number
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
 * Audit helper to inspect and log the visible application's computed styles
 * before, during, and after PDF generation.
 */
export function inspectAppComputedStyles(stage: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return
  const bodyStyle = window.getComputedStyle(document.body)
  const rootStyle = window.getComputedStyle(document.documentElement)
  const mainEl = document.querySelector("main") || document.body
  const mainStyle = window.getComputedStyle(mainEl)

  console.log(`[PDF Audit Stage: ${stage}]`, {
    body: {
      width: bodyStyle.width,
      height: bodyStyle.height,
      minHeight: bodyStyle.minHeight,
      maxHeight: bodyStyle.maxHeight,
      display: bodyStyle.display,
      position: bodyStyle.position,
      overflow: bodyStyle.overflow,
      zoom: (bodyStyle as any).zoom || "1",
      transform: bodyStyle.transform,
    },
    root: {
      width: rootStyle.width,
      height: rootStyle.height,
      overflow: rootStyle.overflow,
    },
    mainLayout: {
      width: mainStyle.width,
      height: mainStyle.height,
      display: mainStyle.display,
      gridTemplateColumns: mainStyle.gridTemplateColumns,
      gridTemplateRows: mainStyle.gridTemplateRows,
      flexDirection: mainStyle.flexDirection,
    },
  })
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
      windowWidth: 800,
      windowHeight: 1120,
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

  console.log("[PDF Step 2] PDF container creation started")
  inspectAppComputedStyles("2. PDF Container Creation - Before DOM Append")

  const wrapper = document.createElement("div")
  wrapper.style.position = "fixed"
  wrapper.style.left = "-10000px"
  wrapper.style.top = "0"
  wrapper.style.width = targetWidth
  wrapper.style.height = "auto"
  wrapper.style.background = "#ffffff"
  wrapper.style.zIndex = "-9999"
  wrapper.style.visibility = "visible"
  wrapper.style.pointerEvents = "none"
  wrapper.style.overflow = "hidden"
  wrapper.innerHTML = html

  document.body.appendChild(wrapper)

  inspectAppComputedStyles("2. PDF Container Creation - After DOM Append")

  const element = (wrapper.querySelector("#doc-root") ||
    wrapper.querySelector("#bill-root") ||
    wrapper.firstElementChild ||
    wrapper) as HTMLElement

  if ("fonts" in document && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      // Font load error gracefully ignored
    }
  }

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
                .catch(() => {})
            }
          })
      )
    )
  }

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
    console.log("[PDF Step 3] PDF rendering start")
    inspectAppComputedStyles("3. PDF Rendering Start")

    const pdfBlob = (await html2pdf().set(opts).from(element).outputPdf("blob")) as Blob

    console.log("[PDF Step 4] PDF rendering completion")
    inspectAppComputedStyles("4. PDF Rendering Completion")

    console.log("[PDF Step 5] Blob creation:", { size: pdfBlob.size, type: pdfBlob.type })
    return pdfBlob
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
      console.log("[PDF Step 8] PDF container cleanup: wrapper unmounted from document.body")
      inspectAppComputedStyles("8. PDF Container Cleanup - After Unmount")
    }
  }
}

/**
 * Standard Central HMS PDF Download Utility
 * Receives a PDF Blob and triggers a direct background file download via hidden <a> element.
 */
export function downloadPdfBlob(blob: Blob, filename = "document.pdf"): void {
  if (typeof window === "undefined") return

  console.log("[PDF Step 6 & 7] Blob URL & Direct Background Download", { filename, size: blob.size })
  const blobUrl = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.style.display = "none"
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl)
  }, 10000)
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

  const opts = { ...getDefaultHtml2PdfOptions(filename), ...options }

  try {
    const blob = await renderHTMLToPdfBlob(html, opts)
    downloadPdfBlob(blob, filename)
  } catch (err) {
    console.error("PDF download error:", err)
    const html2pdf = await getHtml2Pdf()
    if (!html2pdf) throw new Error("html2pdf.js library is unavailable")
    const { wrapper, element } = await prepareContainerAndAssets(html)
    try {
      await html2pdf().set(opts).from(element).save()
    } finally {
      if (document.body.contains(wrapper)) {
        document.body.removeChild(wrapper)
        console.log("[PDF Step 8] PDF container cleanup (fallback)")
        inspectAppComputedStyles("8. PDF Container Cleanup Fallback")
      }
    }
  }
}

/**
 * Renders HTML string to PDF and triggers direct background file download (preserves screen UI)
 */
export async function renderHTMLToPdfOpen(
  html: string,
  filename = "document.pdf",
  options?: Html2PdfOptions
): Promise<void> {
  if (typeof window === "undefined") return
  await renderHTMLToPdfDownload(html, filename, options)
}
