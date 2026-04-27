import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Download, FileSpreadsheet, FileText, UploadCloud, Wrench } from 'lucide-react'

import { listClients } from '../api/clients'
import { exportTicketsFile, importTicketsFile, type TicketExportParams, type TicketImportResult } from '../api/tickets'

type ActiveTool = 'export' | 'import' | null
type ExportRange = TicketExportParams['range']

function extractFileName(contentDisposition: string | undefined, fallback: string) {
  if (!contentDisposition) return fallback
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
  const plainMatch = /filename="?([^"]+)"?/i.exec(contentDisposition)
  return plainMatch?.[1] || fallback
}

async function parseAxiosError(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback

  const status = err.response?.status
  const payload = err.response?.data
  if (payload instanceof Blob) {
    try {
      const txt = await payload.text()
      const parsed = JSON.parse(txt) as { message?: string; errors?: unknown; detail?: string }
      const errorObj = parsed.errors as { detail?: unknown } | undefined
      const errorsDetail = typeof errorObj?.detail === 'string' ? errorObj.detail : undefined
      const detail = parsed.detail || errorsDetail || parsed.message || (parsed.errors ? JSON.stringify(parsed.errors) : '')
      return detail ? `Request failed (${status}): ${detail}` : `Request failed (${status})`
    } catch {
      return `Request failed (${status})`
    }
  }

  const data = payload as { message?: string; errors?: unknown; detail?: string } | undefined
  const errorObj = data?.errors as { detail?: unknown } | undefined
  const errorsDetail = typeof errorObj?.detail === 'string' ? errorObj.detail : undefined
  const detail =
    data?.detail ||
    errorsDetail ||
    data?.message ||
    (data?.errors ? JSON.stringify(data.errors) : '')
  return detail ? `Request failed (${status}): ${detail}` : `Request failed (${status})`
}

function defaultFileName(format: 'csv' | 'pdf') {
  const stamp = new Date().toISOString().slice(0, 10)
  return `tickets-export-${stamp}.${format}`
}

export function ToolsPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [activeTool, setActiveTool] = useState<ActiveTool>('export')

  const [exportClientId, setExportClientId] = useState('')
  const [exportRange, setExportRange] = useState<ExportRange>('day')
  const [exportDate, setExportDate] = useState(today)
  const [exportStartDate, setExportStartDate] = useState(today)
  const [exportEndDate, setExportEndDate] = useState(today)
  const [exportLoading, setExportLoading] = useState<'csv' | 'pdf' | null>(null)

  const [importClientId, setImportClientId] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<TicketImportResult | null>(null)

  const clientsQuery = useQuery({
    queryKey: ['clients', 'tools'],
    queryFn: async () => {
      const res = await listClients()
      return res.data.results
    },
  })

  const clients = clientsQuery.data ?? []

  async function downloadExport(format: 'csv' | 'pdf') {
    if (!exportClientId) {
      toast.error('Please select a client first')
      return
    }

    const params: TicketExportParams = {
      client_id: exportClientId,
      range: exportRange,
      file_type: format,
      ...(exportRange === 'custom'
        ? { start_date: exportStartDate, end_date: exportEndDate }
        : { date: exportDate }),
    }

    setExportLoading(format)
    try {
      const response = await exportTicketsFile(params)
      const fileName = extractFileName(
        response.headers['content-disposition'] as string | undefined,
        defaultFileName(format),
      )

      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} export downloaded`)
    } catch (err) {
      toast.error(await parseAxiosError(err, 'Export failed'))
    } finally {
      setExportLoading(null)
    }
  }

  async function onImport() {
    if (!importClientId) {
      toast.error('Please select a client first')
      return
    }
    if (!importFile) {
      toast.error('Please choose a CSV file')
      return
    }

    setImportLoading(true)
    try {
      const res = await importTicketsFile(importClientId, importFile)
      setImportResult(res.data)
      toast.success('CSV import completed')
    } catch (err) {
      toast.error(await parseAxiosError(err, 'Import failed'))
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">Tools</div>
          <div className="mt-1 text-sm text-text-secondary">
            Utility tools for ticket operations. More tools can be added here later.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActiveTool('export')}
          className={[
            'group flex h-[110px] w-[130px] flex-col items-center justify-center gap-2 border transition',
            activeTool === 'export'
              ? 'border-accent-primary/55 bg-accent-primary/10'
              : 'border-border-subtle bg-bg-card hover:bg-bg-hover/70',
          ].join(' ')}
        >
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary/20 text-text-primary">
            <Download className="h-4 w-4" />
          </div>
          <div className="text-xs font-semibold">Export</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('import')}
          className={[
            'group flex h-[110px] w-[130px] flex-col items-center justify-center gap-2 border transition',
            activeTool === 'import'
              ? 'border-accent-primary/55 bg-accent-primary/10'
              : 'border-border-subtle bg-bg-card hover:bg-bg-hover/70',
          ].join(' ')}
        >
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary/20 text-text-primary">
            <UploadCloud className="h-4 w-4" />
          </div>
          <div className="text-xs font-semibold">Import</div>
        </button>
      </div>

      <div className="text-sm text-text-secondary">
        {activeTool === 'export'
          ? 'Export a client ticket list by day, week, month, or custom range as CSV or PDF.'
          : 'Upload a CSV with ticket fields and import records into the selected client.'}
      </div>

      {activeTool === 'export' ? (
        <section className="border border-border-subtle bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
            <FileSpreadsheet className="h-4 w-4" />
            Export Ticket Data
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-medium text-text-secondary">Client</label>
              <select
                value={exportClientId}
                onChange={(e) => setExportClientId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Range Type</label>
              <select
                value={exportRange}
                onChange={(e) => setExportRange(e.target.value as ExportRange)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {exportRange === 'custom' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-1">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">Start Date</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">End Date</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Reference Date</label>
                <input
                  type="date"
                  value={exportDate}
                  onChange={(e) => setExportDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
                />
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadExport('csv')}
              disabled={exportLoading !== null}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportLoading === 'csv' ? 'Exporting CSV...' : 'Download CSV'}
            </button>
            <button
              type="button"
              onClick={() => downloadExport('pdf')}
              disabled={exportLoading !== null}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-subtle bg-bg-secondary px-4 text-sm font-medium text-text-primary transition hover:bg-bg-hover disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              {exportLoading === 'pdf' ? 'Exporting PDF...' : 'Download PDF'}
            </button>
          </div>
        </section>
      ) : null}

      {activeTool === 'import' ? (
        <section className="border border-border-subtle bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
            <Wrench className="h-4 w-4" />
            Import Ticket Data
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Client</label>
              <select
                value={importClientId}
                onChange={(e) => setImportClientId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 text-sm text-text-primary focus:border-accent-primary focus:ring-accent-primary/30"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-medium text-text-secondary">CSV File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
              />
            </div>
          </div>

          <div className="mt-4 text-xs text-text-secondary">
            CSV must include these headers (case-insensitive):
            {' '}
            <span className="font-medium text-text-primary">date, ticket, agent, level, status, worked</span>.
            {' '}Optional: detail.
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={onImport}
              disabled={importLoading}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-primary px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              {importLoading ? 'Importing...' : 'Import CSV'}
            </button>
          </div>

          {importResult ? (
            <div className="mt-5 border border-border-subtle bg-bg-secondary p-4">
              <div className="text-sm font-medium text-text-primary">Import Summary</div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div className="text-text-secondary">
                  Created: <span className="font-medium text-text-primary">{importResult.created}</span>
                </div>
                <div className="text-text-secondary">
                  Updated: <span className="font-medium text-text-primary">{importResult.updated}</span>
                </div>
                <div className="text-text-secondary">
                  Failed: <span className="font-medium text-text-primary">{importResult.failed}</span>
                </div>
              </div>

              {importResult.errors?.length ? (
                <div className="mt-3">
                  <div className="text-xs font-medium text-text-secondary">Row Errors</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-secondary">
                    {importResult.errors.slice(0, 10).map((error, idx) => (
                      <li key={`${idx}-${error}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
