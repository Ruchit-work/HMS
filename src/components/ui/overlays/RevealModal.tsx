"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

const DURATION_MS = 280

const revealModalStyles = `
  .reveal-modal-overlay {
    opacity: 0;
    transition: opacity 0.28s ease-out;
  }
  .reveal-modal-overlay.reveal-modal-visible {
    opacity: 1;
  }
  .reveal-modal-overlay.reveal-modal-exiting {
    opacity: 0;
    transition-duration: 0.22s;
  }
  .reveal-modal-content {
    opacity: 0;
    transform: scale(0.92);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out;
  }
  .reveal-modal-content.reveal-modal-visible {
    opacity: 1;
    transform: scale(1);
  }
  .reveal-modal-content.reveal-modal-exiting {
    opacity: 0;
    transform: scale(0.94);
    transition-duration: 0.22s;
    transition-timing-function: ease-in;
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal-modal-overlay,
    .reveal-modal-content,
    .reveal-modal-overlay.reveal-modal-visible,
    .reveal-modal-content.reveal-modal-visible,
    .reveal-modal-overlay.reveal-modal-exiting,
    .reveal-modal-content.reveal-modal-exiting {
      transition-duration: 0.01ms !important;
    }
  }
`

type RevealModalContextValue = { requestClose: () => void }
const RevealModalContext = createContext<RevealModalContextValue | null>(null)

/** Call this inside RevealModal children to close with the reveal-out animation. */
export function useRevealModalClose(): () => void {
  const ctx = useContext(RevealModalContext)
  return useCallback(() => ctx?.requestClose?.() ?? (() => {}), [ctx])
}

export interface RevealModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  /** If true, clicking the backdrop closes the modal (with animation). Default false. */
  closeOnOverlayClick?: boolean
  /** Extra class for the overlay div. */
  overlayClassName?: string
  /** Extra class for the content wrapper div. */
  contentClassName?: string
  /** Optional id for aria-labelledby on the dialog. */
  ariaLabelledBy?: string
  /** Optional z-index (default 50). */
  zIndex?: number
}

export function RevealModal({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = false,
  overlayClassName = "",
  contentClassName = "",
  ariaLabelledBy,
  zIndex = 50,
}: RevealModalProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const requestClose = useCallback(() => {
    setIsExiting((prev) => {
      if (prev) return prev
      return true
    })
  }, [])

  useEffect(() => {
    if (!isOpen) {
      if (!isExiting) setIsVisible(false)
      return
    }
    setIsVisible(false)
    const id = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  useEffect(() => {
    if (!isExiting) return
    const el = contentRef.current
    if (!el) {
      onClose()
      setIsExiting(false)
      return
    }
    const done = () => {
      onClose()
      setIsExiting(false)
    }
    const t = setTimeout(done, DURATION_MS)
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "opacity") return
      clearTimeout(t)
      el.removeEventListener("transitionend", onEnd)
      done()
    }
    el.addEventListener("transitionend", onEnd)
    return () => {
      clearTimeout(t)
      el.removeEventListener("transitionend", onEnd)
    }
  }, [isExiting, onClose])

  const show = isOpen || isExiting
  if (!show) return null

  const overlayClasses = [
    "reveal-modal-overlay",
    isVisible && !isExiting && "reveal-modal-visible",
    isExiting && "reveal-modal-exiting",
  ]
    .filter(Boolean)
    .join(" ")
  const contentClasses = [
    "reveal-modal-content",
    isVisible && !isExiting && "reveal-modal-visible",
    isExiting && "reveal-modal-exiting",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <RevealModalContext.Provider value={{ requestClose }}>
      <style dangerouslySetInnerHTML={{ __html: revealModalStyles }} />
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 ${overlayClasses} ${overlayClassName}`}
        style={{ zIndex }}
        role="dialog"
        aria-modal="true"
        {...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {})}
        onClick={
          closeOnOverlayClick
            ? (e) => e.target === e.currentTarget && requestClose()
            : undefined
        }
      >
        <div
          ref={contentRef}
          className={`${contentClasses} ${contentClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </RevealModalContext.Provider>
  )
}
