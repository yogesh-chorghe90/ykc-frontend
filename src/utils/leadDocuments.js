export function humanizeDocumentType(t) {
  if (!t || typeof t !== 'string') return 'Document'
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Merge API document rows with embedded lead.documents (dedupe by URL / id). */
export function mergeLeadDocumentsFromApiAndEmbedded(apiDocs, embeddedDocs) {
  const list = Array.isArray(apiDocs) ? [...apiDocs] : []
  const urls = new Set(list.map((d) => d?.url).filter(Boolean))
  const ids = new Set(
    list.map((d) => (d?._id || d?.id ? String(d._id || d.id) : '')).filter(Boolean)
  )
  for (const e of embeddedDocs || []) {
    if (!e || typeof e !== 'object') continue
    const url = e.url
    const eid = e._id || e.id
    if (eid && ids.has(String(eid))) continue
    if (url && urls.has(url)) continue
    if (url) urls.add(url)
    if (eid) ids.add(String(eid))
    const fileFromUrl = url ? decodeURIComponent(String(url).split('/').pop() || '') : ''
    list.push({
      documentType: e.documentType || 'document',
      fileName: e.fileName || e.originalFileName || e.name || fileFromUrl || 'Document',
      originalFileName: e.originalFileName || e.fileName,
      fileSize: e.fileSize,
      url,
      _id: e._id || e.id,
    })
  }
  return list
}
