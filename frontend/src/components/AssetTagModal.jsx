import { useEffect } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'

export default function AssetTagModal({ isOpen, onClose, asset }) {
  // Escape closes the dialog
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen || !asset) return null

  const assetUrl = `${window.location.origin}/assets/${asset.id}`

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
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Asset tag"
      >
        <div className="modal-header">
          <div>
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>Physical asset tag</h3>
            <p className="text-[12px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
              Print it, stick it on the hardware, scan it to audit.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="modal-body">
          {/* The sticker is deliberately its own visual world — a dashed cut
              line and pure white ground, so what you see is what prints. */}
          <div id="printable-asset-tag" className="tag-sheet">
            <div className="tag-brand">ITIMS · ENTERPRISE ASSET MANAGEMENT</div>

            <div className="tag-qr">
              <QRCodeSVG value={assetUrl} size={132} level="H" includeMargin={false} />
            </div>

            {/* Hidden canvas for high-resolution PNG export */}
            <div className="hidden">
              <QRCodeCanvas id="asset-tag-canvas" value={assetUrl} size={512} level="H" includeMargin={true} />
            </div>

            <div className="tag-meta">
              <p className="tag-name">{asset.name}</p>
              <dl className="tag-rows">
                <div>
                  <dt>Type</dt>
                  <dd className="uppercase">{asset.type}</dd>
                </div>
                <div>
                  <dt>Serial</dt>
                  <dd>{asset.serial_number || '—'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{asset.location || 'HQ'}</dd>
                </div>
                <div>
                  <dt>Asset ID</dt>
                  <dd>{asset.id.slice(0, 18)}…</dd>
                </div>
              </dl>
            </div>
          </div>

          <p className="text-[11.5px] text-center mt-3 mb-0" style={{ color: 'var(--text-muted)' }}>
            Scanning the code opens this asset record or starts a physical audit.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">Close</button>
          <button type="button" onClick={handleDownloadPNG} className="btn-secondary btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            PNG
          </button>
          <button type="button" onClick={handlePrint} className="btn-primary btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print sticker
          </button>
        </div>

        <style>{`
          .tag-sheet {
            display: flex; flex-direction: column; align-items: center;
            padding: 16px;
            border-radius: 12px;
            background: #fff;
            border: 2px dashed #cbd5e1;
            color: #0f172a;
          }
          .tag-brand {
            width: 100%;
            padding-bottom: 7px;
            margin-bottom: 13px;
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
            text-align: center; text-transform: uppercase;
            color: #64748b;
            border-bottom: 1px solid #e2e8f0;
          }
          .tag-qr {
            padding: 9px;
            border-radius: 9px;
            background: #fff;
            border: 1px solid #e2e8f0;
            margin-bottom: 13px;
          }
          .tag-meta { width: 100%; }
          .tag-name {
            margin: 0 0 7px;
            font-size: 13px; font-weight: 700; line-height: 1.25;
            overflow-wrap: anywhere;
          }
          .tag-rows {
            margin: 0;
            border-radius: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            overflow: hidden;
          }
          .tag-rows > div {
            display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
            padding: 5px 9px;
            border-bottom: 1px solid #eef2f7;
          }
          .tag-rows > div:last-child { border-bottom: none; }
          .tag-rows dt {
            font-size: 9.5px; font-weight: 600; letter-spacing: 0.06em;
            text-transform: uppercase; color: #94a3b8;
          }
          .tag-rows dd {
            margin: 0;
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-size: 10.5px; font-weight: 600; text-align: right;
            color: #1e293b;
            min-width: 0; overflow-wrap: anywhere;
          }

          /* Print used to send the entire dashboard to the printer. Only the
             sticker should reach paper. */
          @media print {
            body * { visibility: hidden !important; }
            #printable-asset-tag, #printable-asset-tag * { visibility: visible !important; }
            #printable-asset-tag {
              position: fixed !important;
              top: 0; left: 0;
              width: 62mm;
              margin: 10mm;
              border: 1px solid #94a3b8 !important;
              box-shadow: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
