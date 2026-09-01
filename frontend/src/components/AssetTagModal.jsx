import React, { useRef } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'

export default function AssetTagModal({ isOpen, onClose, asset }) {
  const canvasRef = useRef(null)

  if (!isOpen || !asset) return null

  const assetUrl = `${window.location.origin}/assets/${asset.id}`
  const qrPayload = JSON.stringify({
    id: asset.id,
    name: asset.name,
    serial: asset.serial_number || 'N/A',
    url: assetUrl
  })

  function handleDownloadPNG() {
    try {
      const canvas = document.getElementById('asset-tag-canvas')
      if (!canvas) return
      const pngUrl = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = pngUrl
      downloadLink.download = `Asset_Tag_${asset.name.replace(/\s+/g, '_')}_${asset.id.slice(0, 8)}.png`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      toast.success('Asset Tag QR downloaded!')
    } catch (err) {
      toast.error('Failed to download QR image')
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-space">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Physical Asset Tag & QR Sticker
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Printable Asset Tag Sticker Preview */}
        <div 
          id="printable-asset-tag"
          className="bg-white text-slate-900 p-4 rounded-xl shadow-inner border-2 border-dashed border-slate-400 flex flex-col items-center justify-center text-center my-2"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1 w-full mb-3">
            ITIMS • ENTERPRISE ASSET MANAGEMENT
          </div>

          <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm mb-3">
            <QRCodeSVG
              value={assetUrl}
              size={130}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Hidden Canvas for High-Resolution PNG Export */}
          <div className="hidden">
            <QRCodeCanvas
              id="asset-tag-canvas"
              value={assetUrl}
              size={512}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="w-full text-left bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
            <div className="text-xs font-black text-slate-900 truncate">
              {asset.name}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
              <span>Type: <strong className="uppercase">{asset.type}</strong></span>
              <span>SN: <strong>{asset.serial_number || 'N/A'}</strong></span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
              <span className="truncate">ID: {asset.id.slice(0, 18)}...</span>
              <span>{asset.location || 'HQ'}</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-2">
          Scan this sticker with any camera or scanner to jump to this asset record or initiate a physical audit.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownloadPNG}
            className="px-4 py-2 text-xs font-semibold text-purple-300 hover:text-purple-200 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>⬇️</span> Download PNG
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🖨️</span> Print Sticker
          </button>
        </div>
      </div>
    </div>
  )
}
