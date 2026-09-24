import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import toast from 'react-hot-toast'

export default function QRScannerModal({ isOpen, onClose, onAssetScanned }) {
  const navigate = useNavigate()
  const [scannedResult, setScannedResult] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const scannerRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setScannedResult(null)
      setCameraError(null)
      startScanner()
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [isOpen])

  // Escape closes the dialog — and the effect above releases the camera
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  function playSuccessBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch (e) {
      // Audio context might be restricted
    }
  }

  function parseAssetId(text) {
    if (!text) return null
    const str = String(text).trim()

    // 1. Check if URL containing /assets/<uuid>
    const urlMatch = str.match(/\/assets\/([0-9a-fA-F-]{36})/)
    if (urlMatch) return urlMatch[1]

    // 2. Check if raw UUID
    const uuidMatch = str.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/)
    if (uuidMatch) return uuidMatch[1]

    // 3. Check if JSON payload
    try {
      const parsed = JSON.parse(str)
      if (parsed.id) return parsed.id
    } catch (e) {
      // Not JSON
    }

    return str
  }

  async function startScanner() {
    try {
      const elementId = 'qr-reader-viewfinder'
      const html5QrCode = new Html5Qrcode(elementId)
      scannerRef.current = html5QrCode

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      }

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          playSuccessBeep()
          const assetId = parseAssetId(decodedText)
          setScannedResult({ raw: decodedText, assetId })
          toast.success('Asset code scanned successfully!')
          stopScanner()
        },
        (errorMessage) => {
          // Frame-by-frame scanning noise, do not log
        }
      )
    } catch (err) {
      console.error('Camera startup error:', err)
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.')
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (err) {
        // Scanner cleanup
      }
      scannerRef.current = null
    }
  }

  if (!isOpen) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Scan asset tag"
      >
        <div className="modal-header">
          <div>
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>Scan asset tag</h3>
            <p className="text-[12px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
              Point the camera at a QR or 1D barcode sticker.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="modal-body">
          {!scannedResult ? (
            <>
              {/* The viewfinder stays black regardless of theme — it frames a
                  camera feed, not a surface. */}
              <div className="viewfinder">
                <div id="qr-reader-viewfinder" className="w-full h-full" />

                {!cameraError && (
                  <>
                    <span className="vf-corner" data-c="tl" />
                    <span className="vf-corner" data-c="tr" />
                    <span className="vf-corner" data-c="bl" />
                    <span className="vf-corner" data-c="br" />
                    {/* Constant motion, so a keyframe loop is right here */}
                    <span className="vf-laser" />
                  </>
                )}

                {cameraError && (
                  <div className="vf-error">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    <p className="text-[12px] font-semibold mt-2.5 mb-0" style={{ color: '#fca5a5' }}>{cameraError}</p>
                    <p className="text-[11px] mt-1 mb-0" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Enable camera access in your browser permissions, then reopen this dialog.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[11.5px] text-center mt-3 mb-0" style={{ color: 'var(--text-muted)' }}>
                Hold steady — detection fires on its own, no shutter button.
              </p>
            </>
          ) : (
            <div className="scan-result">
              <div className="scan-check">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <p className="text-[13px] font-bold mt-3 mb-1.5" style={{ color: 'var(--text)' }}>Code detected</p>
              <p
                className="text-[11.5px] font-mono px-2.5 py-2 rounded-lg m-0 break-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--brand)' }}
              >
                {scannedResult.assetId}
              </p>

              <div className="flex flex-col gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate(`/assets/${scannedResult.assetId}`)
                  }}
                  className="btn-primary w-full"
                >
                  Open asset record
                </button>

                {onAssetScanned && (
                  <button
                    type="button"
                    onClick={() => {
                      onAssetScanned(scannedResult.assetId)
                      onClose()
                    }}
                    className="btn-success w-full"
                  >
                    Log physical audit
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setScannedResult(null)
                    startScanner()
                  }}
                  className="btn-ghost btn-sm w-full"
                >
                  Scan another tag
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">Close</button>
        </div>

        <style>{`
          .viewfinder {
            position: relative;
            aspect-ratio: 1;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
            border-radius: 12px;
            background: #05070d;
            border: 1px solid var(--line);
          }

          /* Corner brackets tell you where to aim without covering the feed */
          .vf-corner {
            position: absolute;
            width: 26px; height: 26px;
            border: 2px solid rgba(255, 255, 255, 0.75);
            pointer-events: none;
          }
          .vf-corner[data-c='tl'] { top: 14px; left: 14px;  border-right: none; border-bottom: none; border-radius: 8px 0 0 0; }
          .vf-corner[data-c='tr'] { top: 14px; right: 14px; border-left: none;  border-bottom: none; border-radius: 0 8px 0 0; }
          .vf-corner[data-c='bl'] { bottom: 14px; left: 14px;  border-right: none; border-top: none; border-radius: 0 0 0 8px; }
          .vf-corner[data-c='br'] { bottom: 14px; right: 14px; border-left: none;  border-top: none; border-radius: 0 0 8px 0; }

          /* The line rides the bottom edge of a full-height track, so the
             sweep is a plain percentage transform — no measured pixel
             distance, no container query, works at any viewfinder size. */
          .vf-laser {
            position: absolute;
            top: 16px; right: 16px; bottom: 16px; left: 16px;
            pointer-events: none;
            animation: vf-sweep 2.4s linear infinite;
          }
          .vf-laser::after {
            content: '';
            position: absolute;
            left: 0; right: 0; bottom: 0;
            height: 2px;
            border-radius: 2px;
            background: linear-gradient(90deg, transparent, #22d3ee, transparent);
            box-shadow: 0 0 12px rgba(34, 211, 238, 0.8);
          }
          /* linear, because a scan line moves at a constant rate — easing
             would read as the beam hesitating. */
          @keyframes vf-sweep {
            0%   { transform: translateY(-100%); opacity: 0; }
            12%  { opacity: 1; }
            88%  { opacity: 1; }
            100% { transform: translateY(0);     opacity: 0; }
          }

          .vf-error {
            position: absolute; inset: 0;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 20px; text-align: center;
            background: rgba(5, 7, 13, 0.92);
          }

          .scan-result {
            padding: 18px;
            border-radius: 12px;
            text-align: center;
            background: var(--surface-sunk);
            border: 1px solid var(--line);
          }
          .scan-check {
            display: inline-flex; align-items: center; justify-content: center;
            width: 38px; height: 38px;
            border-radius: 50%;
            color: var(--ok);
            background: var(--ok-soft);
            border: 1px solid var(--ok-line);
            transform: scale(1);
            transition: transform var(--t-pop) var(--ease-out);
          }
          /* Starts at 0.9, never 0 — the check grows into place */
          @starting-style { .scan-check { transform: scale(0.9); } }

          /* Reduced motion keeps the aiming line — it tells you where to
             centre the code — it just parks it mid-frame instead of sweeping. */
          @media (prefers-reduced-motion: reduce) {
            .vf-laser { animation: none; transform: translateY(-50%); }
            .scan-check { transition: none; }
          }
        `}</style>
      </div>
    </div>
  )
}
