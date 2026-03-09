'use client'

/**
 * Barcode scanner using device camera (phone or PC).
 * Uses html5-qrcode; on successful scan calls onScan(barcodeValue).
 * When active=false, stops the camera first to avoid "play() interrupted" (media removed).
 */

import { useEffect, useRef, useState } from 'react'

const CAMERA_SCAN_ID = 'pharmacy-barcode-camera'

function isAbortOrRemovedError(err: unknown): boolean {
  if (err instanceof Error) {
    const name = (err as { name?: string }).name
    const msg = (err as { message?: string }).message ?? ''
    return name === 'AbortError' || name === 'NotAllowedError' || /interrupted|removed from the document|play\(\)/i.test(msg)
  }
  return false
}

import { playScanBeep } from '@/utils/scanBeep'

export function BarcodeCameraScanner({
  onScan,
  onError,
  disabled = false,
  active = true,
  className = '',
}: {
  /** Called with the scanned barcode string (e.g. A4453444534A) */
  onScan: (barcodeValue: string) => void
  onError?: (message: string) => void
  disabled?: boolean
  /** When false, camera is stopped (avoids play() interrupted when parent hides this) */
  active?: boolean
  className?: string
}) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error' | 'stopped'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastScannedValue, setLastScannedValue] = useState<string | null>(null)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const lastScannedAtRef = useRef<number>(0)
  const cooldownMs = 2000

  // When active becomes false, stop the camera so the video element is not removed while playing
  useEffect(() => {
    if (!active) {
      setStatus('stopped')
      const scanner = scannerRef.current
      scannerRef.current = null
      if (scanner) {
        scanner.stop().catch(() => {})
      }
      return
    }
  }, [active])

  useEffect(() => {
    if (!active || disabled || typeof window === 'undefined') return

    let mounted = true
    const elementId = CAMERA_SCAN_ID

    const startWithFacingMode = async (facingMode: 'environment' | 'user'): Promise<boolean> => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        const html5Qrcode = new Html5Qrcode(elementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        })

        await html5Qrcode.start(
          { facingMode },
          {
            fps: 15,
            videoConstraints: { facingMode },
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.max(180, Math.min(viewfinderWidth, viewfinderHeight) * 0.8)
              return {
                width: size,
                height: size,
              }
            },
          },
          (decodedText: string) => {
            if (!mounted) return
            const trimmed = decodedText.trim()
            if (!trimmed) return
            const now = Date.now()
            if (now - lastScannedAtRef.current < cooldownMs) return
            lastScannedAtRef.current = now
            setLastScannedValue(trimmed)
            setTimeout(() => mounted && setLastScannedValue(null), 3000)
            playScanBeep()
            onScan(trimmed)
          },
          () => {}
        )

        if (mounted && active) {
          scannerRef.current = html5Qrcode
          setStatus('scanning')
          return true
        } else {
          await html5Qrcode.stop().catch(() => {})
          return false
        }
      } catch (err) {
        if (isAbortOrRemovedError(err)) return false
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Could not start camera'
          setStatus('error')
          setErrorMessage(msg)
          onError?.(msg)
        }
        return false
      }
    }

    const startCamera = async () => {
      setStatus('starting')
      setErrorMessage(null)
      // Try back camera first; if not available, fall back to front camera
      const ok = await startWithFacingMode('environment')
      if (!ok && mounted) {
        await startWithFacingMode('user')
      }
    }

    startCamera()
    return () => {
      mounted = false
      const scanner = scannerRef.current
      scannerRef.current = null
      scanner?.stop().catch(() => {})
    }
  }, [active, disabled, onScan, onError])

  if (disabled) return null
  if (!active) return <div className={`min-h-[120px] ${className}`} aria-hidden />

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        #${CAMERA_SCAN_ID} { position: relative; width: 100%; height: 100%; min-height: 280px; overflow: hidden; }
        #${CAMERA_SCAN_ID} video { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; }
        #${CAMERA_SCAN_ID} canvas { position: absolute !important; top: 0 !important; left: 0 !important; }
        #${CAMERA_SCAN_ID} [id="qr-shaded-region"] { position: absolute !important; }
      ` }} />
      <div
        id={CAMERA_SCAN_ID}
        className="rounded-lg overflow-hidden bg-slate-900 w-full max-w-md mx-auto"
        style={{ width: '100%', minWidth: 280, height: 320, minHeight: 320 }}
      />
      {status === 'starting' && <p className="text-sm text-slate-600 text-center">Starting camera…</p>}
      {status === 'scanning' && !lastScannedValue && (
        <p className="text-sm text-slate-600 text-center">
          Point camera at barcode. Hold 1D barcode with bars vertical, good lighting.
        </p>
      )}
      {lastScannedValue && (
        <p className="text-sm font-medium text-green-700 text-center">Scanned: {lastScannedValue}</p>
      )}
      {status === 'error' && errorMessage && (
        <p className="text-sm text-red-600 text-center">{errorMessage}</p>
      )}
    </div>
  )
}
