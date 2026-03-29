/**
 * AccountingPage — Ledger, Trial Balance, eTax Compliance Dashboard
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  BookOpen, TrendingUp, Shield, RefreshCw,
  CheckCircle, AlertTriangle, XCircle, Clock,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import {
  PageHeader, Btn, Card, DataTable, Badge, StatCard, FormInput, FormField,
} from '../components/shared'

const ETAX_STATUS = {
  pending:   { label:'Pending',   color:'#C45A00', bg:'#FEF0E6' },
  submitted: { label:'Submitted', color:'#1A3FA6', bg:'#EAF0FB' },
  accepted:  { label:'Accepted',  color:'#1A6E3A', bg:'#EAF5EE' },
  rejected:  { label:'Rejected',  color:'#C0392B', bg:'#FDECEA' },
  failed:    { label:'Failed',    color:'#C0392B', bg:'#FDECEA' },
  skipped:   { label:'Skipped',   color:'#8A9AB5', bg:'#F0F4F8' },
}

function EtaxStatusBadge({ status }) {
  const m = ETAX_STATUS[status] ?? ETAX_STATUS.pending
  return <span style={{ display:'inline-block',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:m.bg,color:m.color }}>{m.label}</span>
}

export function AccountingPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('ledger') // ledger | trial | etax

  const now     = new Date()
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(endOfMonth(now),   'yyyy-MM-dd'))
  const [journalPage, setJournalPage] = useState(1)
  const [etaxPage,    setEtaxPage]    = useState(1)

  // ── Journal entries ───────────────────────────────────────────────────────
  const journalQuery = useQuery({
    queryKey: ['journal-entries', journalPage, dateFrom, dateTo],
    enabled: tab === 'ledger',
    queryFn: async () => {
      const res = await api.get('/accounting/journal-entries', {
        params: { page: journalPage, per_page: 20, date_from: dateFrom, date_to: dateTo },
      })
      return res.data
    },
    staleTime: 30_000,
  })

  // ── Trial balance ─────────────────────────────────────────────────────────
  const trialQuery = useQuery({
    queryKey: ['trial-balance', dateFrom, dateTo],
    enabled: tab === 'trial',
    queryFn: async () => {
      const res = await api.get('/accounting/trial-balance', {
        params: { date_from: dateFrom, date_to: dateTo },
      })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  // ── eTax submissions ──────────────────────────────────────────────────────
  const etaxQuery = useQuery({
    queryKey: ['etax-submissions', etaxPage],
    enabled: tab === 'etax',
    queryFn: async () => {
      const res = await api.get('/accounting/etax/submissions', {
        params: { page: etaxPage, per_page: 20 },
      })
      return res.data
    },
    staleTime: 30_000,
  })

  const retryMutation = useMutation({
    mutationFn: (branchId) => api.post(`/accounting/etax/retry/${branchId}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey:['etax-submissions'] })
      toast.success(`Retried ${res.data?.data?.retried ?? 0} submissions`)
    },
    onError: () => toast.error('Retry failed'),
  })

  const journals  = journalQuery.data?.data ?? []
  const trialData = trialQuery.data ?? []
  const etaxData  = etaxQuery.data?.data ?? []

  // ── Trial balance summary ─────────────────────────────────────────────────
  const totalDebits  = trialData.reduce((s, r) => s + r.total_debit, 0)
  const totalCredits = trialData.reduce((s, r) => s + r.total_credit, 0)
  const isBalanced   = Math.abs(totalDebits - totalCredits) < 0.01

  // ── eTax stats ────────────────────────────────────────────────────────────
  const etaxAccepted = etaxData.filter(e => e.submission_status === 'accepted').length
  const etaxFailed   = etaxData.filter(e => ['failed','rejected'].includes(e.submission_status)).length
  const etaxPending  = etaxData.filter(e => e.submission_status === 'pending').length

  // ── Journal columns ───────────────────────────────────────────────────────
  const journalCols = useMemo(() => [
    {
      key: 'voucher',
      header: 'Voucher',
      cell: (r) => (
        <div>
          <div style={{ fontFamily:'monospace',fontWeight:700,color:'#1A3FA6',fontSize:12 }}>{r.voucher_number}</div>
          <div style={{ fontSize:11,color:'#8A9AB5' }}>{r.type}</div>
        </div>
      ),
    },
    { key:'description', header:'Description', cell:(r) => <span style={{ fontSize:12,color:'#3A4A5C' }}>{r.description}</span> },
    { key:'date', header:'Date', cell:(r) => <span style={{ fontSize:11,color:'#8A9AB5' }}>{format(new Date(r.entry_date),'dd MMM yyyy')}</span> },
    { key:'amount', header:'Amount', cell:(r) => <span style={{ fontWeight:700,color:'#1C2B3A' }}>{money(r.total_amount)}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => {
        const COLOR = { posted:'success', draft:'warning', reversed:'danger' }
        return <Badge color={COLOR[r.status] ?? 'default'}>{r.status}</Badge>
      },
    },
    { key:'by', header:'By', cell:(r) => <span style={{ fontSize:11,color:'#8A9AB5' }}>{r.created_by?.name ?? '—'}</span> },
  ], [])

  // ── eTax columns ──────────────────────────────────────────────────────────
  const etaxCols = useMemo(() => [
    { key:'doc', header:'Document', cell:(r) => (
      <div>
        <div style={{ fontFamily:'monospace',fontSize:12,fontWeight:700,color:'#1C2B3A' }}>{r.document_number}</div>
        <div style={{ fontSize:11,color:'#8A9AB5' }}>{r.document_type} · {r.source_type}</div>
      </div>
    )},
    { key:'fdn', header:'FIRS FDN', cell:(r) => r.fiscal_document_number
      ? <span style={{ fontFamily:'monospace',fontSize:11,color:'#1A6E3A',fontWeight:700 }}>{r.fiscal_document_number}</span>
      : <span style={{ color:'#D5DFE9',fontSize:11 }}>—</span>
    },
    { key:'amount', header:'Total', cell:(r) => <span style={{ fontWeight:600,fontSize:12 }}>{money(r.total_amount)}</span> },
    { key:'vat', header:'VAT', cell:(r) => <span style={{ fontSize:12,color:'#8A9AB5' }}>{money(r.vat_amount)}</span> },
    { key:'status', header:'Status', cell:(r) => <EtaxStatusBadge status={r.submission_status} /> },
    { key:'date', header:'Submitted', cell:(r) => r.submitted_at
      ? <span style={{ fontSize:11,color:'#8A9AB5' }}>{format(new Date(r.submitted_at),'dd MMM yyyy HH:mm')}</span>
      : '—'
    },
    { key:'retry', header:'', align:'right', cell:(r) => r.hasFailed && r.retry_count < 3
      ? <Btn variant="secondary" size="sm" onClick={() => retryMutation.mutate(r.branch_id)}>Retry</Btn>
      : null
    },
  ], [])

  // ── Trial balance columns ─────────────────────────────────────────────────
  const trialCols = useMemo(() => [
    { key:'code',   header:'Code',    cell:(r) => <span style={{ fontFamily:'monospace',fontWeight:700,color:'#1C2B3A',fontSize:12 }}>{r.account_code}</span> },
    { key:'name',   header:'Account', cell:(r) => <span style={{ fontSize:13,color:'#3A4A5C' }}>{r.account_name}</span> },
    { key:'type',   header:'Type',    cell:(r) => <Badge color="info">{r.account_type}</Badge> },
    { key:'debit',  header:'Total Debits',  cell:(r) => <span style={{ fontWeight:600 }}>{money(r.total_debit)}</span>, align:'right' },
    { key:'credit', header:'Total Credits', cell:(r) => <span style={{ fontWeight:600 }}>{money(r.total_credit)}</span>, align:'right' },
    { key:'net',    header:'Net Balance',   cell:(r) => (
      <span style={{ fontWeight:700, color: r.net_balance >= 0 ? '#1A6E3A' : '#C0392B' }}>
        {money(Math.abs(r.net_balance))} {r.net_balance < 0 ? 'Cr' : 'Dr'}
      </span>
    ), align:'right' },
  ], [])

  return (
    <div>
      <PageHeader
        title="Accounting & Compliance"
        subtitle="General ledger, trial balance, and FIRS eTax compliance submissions."
      />

      {/* Date range selector */}
      <Card style={{ marginBottom:20 }}>
        <div style={{ display:'flex',alignItems:'center',gap:14,flexWrap:'wrap' }}>
          <span style={{ fontSize:12,fontWeight:700,color:'#3A4A5C' }}>Period:</span>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{ padding:'7px 10px',fontSize:12,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',color:'#3A4A5C' }}
            />
            <span style={{ color:'#8A9AB5',fontSize:12 }}>to</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              style={{ padding:'7px 10px',fontSize:12,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',color:'#3A4A5C' }}
            />
          </div>
          {/* Preset buttons */}
          {[
            { label:'This Month', from: format(startOfMonth(now),'yyyy-MM-dd'), to: format(endOfMonth(now),'yyyy-MM-dd') },
            { label:'Last Month', from: format(startOfMonth(subMonths(now,1)),'yyyy-MM-dd'), to: format(endOfMonth(subMonths(now,1)),'yyyy-MM-dd') },
          ].map(p => (
            <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}
              style={{ fontSize:11,padding:'6px 12px',borderRadius:20,border:'1px solid #E5EBF2',background:'#fff',color:'#8A9AB5',cursor:'pointer',fontWeight:600 }}>
              {p.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display:'flex',gap:2,marginBottom:20 }}>
        {[
          { id:'ledger', label:'General Ledger', icon:BookOpen },
          { id:'trial',  label:'Trial Balance',  icon:TrendingUp },
          { id:'etax',   label:'eTax / FIRS',    icon:Shield },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'9px 16px',fontSize:13,fontWeight:600,borderRadius:8,cursor:'pointer',
                border: tab===t.id ? '1px solid var(--edlp-primary)' : '1px solid #E5EBF2',
                background: tab===t.id ? 'rgba(232,160,32,0.08)' : '#fff',
                color: tab===t.id ? '#C98516' : '#8A9AB5',
              }}>
              <Icon size={14}/>{t.label}
            </button>
          )
        })}
      </div>

      {/* ── LEDGER TAB ────────────────────────────────────────────────────── */}
      {tab === 'ledger' && (
        <Card>
          <div style={{ marginBottom:14,fontSize:13,color:'#8A9AB5' }}>
            All posted journal entries (vouchers) for the selected period.
          </div>
          <DataTable
            columns={journalCols}
            rows={journals}
            rowKey={(r)=>r.id}
            loading={journalQuery.isLoading}
            emptyMessage="No journal entries for this period."
            pagination={journalQuery.data?.meta ? {
              current: journalQuery.data.meta.current_page,
              last:    journalQuery.data.meta.last_page,
              total:   journalQuery.data.meta.total,
              onPage:  setJournalPage,
            } : undefined}
          />
        </Card>
      )}

      {/* ── TRIAL BALANCE TAB ─────────────────────────────────────────────── */}
      {tab === 'trial' && (
        <div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:16 }}>
            <StatCard label="Total Debits"  value={money(totalDebits)}  icon={TrendingUp} accent="#1A3FA6" />
            <StatCard label="Total Credits" value={money(totalCredits)} icon={TrendingUp} accent="#1A6E3A" />
            <StatCard
              label="Balance Status"
              value={isBalanced ? 'Balanced ✓' : 'Imbalanced !'}
              icon={isBalanced ? CheckCircle : AlertTriangle}
              accent={isBalanced ? '#1A6E3A' : '#C0392B'}
            />
          </div>
          <Card>
            {!isBalanced && (
              <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'#FDECEA',borderRadius:10,marginBottom:14,fontSize:13,color:'#C0392B',fontWeight:600 }}>
                <AlertTriangle size={15} />
                Trial balance is not balanced. Difference: {money(Math.abs(totalDebits - totalCredits))}. Review your journal entries.
              </div>
            )}
            <DataTable
              columns={trialCols}
              rows={trialData}
              rowKey={(r)=>r.account_code}
              loading={trialQuery.isLoading}
              emptyMessage="No transactions in this period."
            />
          </Card>
        </div>
      )}

      {/* ── ETAX TAB ──────────────────────────────────────────────────────── */}
      {tab === 'etax' && (
        <div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:16 }}>
            <StatCard label="Accepted by FIRS" value={etaxAccepted} icon={CheckCircle} accent="#1A6E3A" />
            <StatCard label="Pending / Queued" value={etaxPending}  icon={Clock}       accent="#C45A00" />
            <StatCard label="Failed / Rejected" value={etaxFailed}  icon={XCircle}     accent="#C0392B" />
          </div>

          {etaxFailed > 0 && (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'#FDECEA',border:'1px solid #FACAC5',borderRadius:10,marginBottom:16 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10,fontSize:13,color:'#C0392B',fontWeight:600 }}>
                <AlertTriangle size={16} />
                {etaxFailed} submission{etaxFailed!==1?'s':''} failed. FIRS requires re-submission for tax compliance.
              </div>
              <Btn variant="danger" size="sm" icon={RefreshCw} onClick={() => retryMutation.mutate(1)}>
                {retryMutation.isPending ? 'Retrying…' : 'Retry Failed'}
              </Btn>
            </div>
          )}

          <Card>
            <div style={{ marginBottom:14,fontSize:13,color:'#8A9AB5' }}>
              Every retail receipt and B2B invoice is transmitted to the FIRS TaxPro-Max gateway.
              A Fiscal Document Number (FDN) is printed on each receipt for customer verification.
            </div>
            <DataTable
              columns={etaxCols}
              rows={etaxData}
              rowKey={(r)=>r.id}
              loading={etaxQuery.isLoading}
              emptyMessage="No eTax submissions found."
              pagination={etaxQuery.data?.meta ? {
                current: etaxQuery.data.meta.current_page,
                last:    etaxQuery.data.meta.last_page,
                total:   etaxQuery.data.meta.total,
                onPage:  setEtaxPage,
              } : undefined}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
