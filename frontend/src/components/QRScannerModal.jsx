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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-space">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl animate-pulse">📷</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Scan Barcode / QR Asset Tag
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Viewfinder or Scanned Result */}
        {!scannedResult ? (
          <div>
            <div className="relative overflow-hidden rounded-xl bg-black border border-slate-700 aspect-square flex items-center justify-center">
              <div id="qr-reader-viewfinder" className="w-full h-full"></div>

              {/* Animated Laser Overlay */}
              <div className="absolute inset-x-8 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#06b6d4] pointer-events-none animate-pulse"></div>

              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
                  <span className="text-3xl mb-2">🚫</span>
                  <p className="text-xs font-semibold text-rose-400">{cameraError}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ensure camera access is enabled in your browser permissions.
                  </p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-3">
              Point your camera at any 2D QR Code or 1D Barcode sticker on equipment.
            </p>
          </div>
        ) : (
          <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 text-center animate-fade-in space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto text-2xl">
              ✓
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">Asset Code Detected</h4>
              <p className="text-xs font-mono text-cyan-300 bg-slate-900 p-2 rounded-lg border border-slate-800 mt-2 break-all">
                {scannedResult.assetId}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate(`/assets/${scannedResult.assetId}`)
                }}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
              >
                🔍 Open Asset Record
              </button>

              {onAssetScanned && (
                <button
                  type="button"
                  onClick={() => {
                    onAssetScanned(scannedResult.assetId)
                    onClose()
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  📋 Log Physical Audit Now
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setScannedResult(null)
                  startScanner()
                }}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              >
                Scan Another Tag
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 mt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
