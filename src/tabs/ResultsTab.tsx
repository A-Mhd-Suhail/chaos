import { useEffect, useState } from 'react';
import { ListChecks, FileText, Search, Download, ExternalLink, Calendar, Building2, User } from 'lucide-react';
import type { MhdUser, ReportDoc } from '../lib/types';
import { fmtD, fmtDT } from '../lib/format';
import Modal from '../components/Modal';
import { bind } from './bind';
import { PageHeader, Loading, EmptyState, StatusChip, FilterPills } from './common';

export default function ResultsTab({ patientData }: { patientData: MhdUser }) {
  const [reports, setReports] = useState<ReportDoc[] | null>(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<ReportDoc | null>(null);

  useEffect(() => bind<ReportDoc>('reports', [['patientId', '==', patientData.id]], setReports), [patientData.id]);

  if (reports === null) return <div className="max-w-[1000px] mx-auto"><Loading /></div>;

  const types = ['All', ...Array.from(new Set(reports.map((r) => r.type)))];
  const list = [...reports].sort((a, b) => b.createdAt - a.createdAt)
    .filter((r) => filter === 'All' || r.type === filter)
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        (r.type && r.type.toLowerCase().includes(q)) ||
        (r.doctor && r.doctor.toLowerCase().includes(q)) ||
        (r.hospital && r.hospital.toLowerCase().includes(q)) ||
        (r.note && r.note.toLowerCase().includes(q))
      );
    });

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="My Lab Reports" sub="Lab reports, scans and diagnostic documents uploaded by your care team and hospital." />
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lab reports..."
            className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-surface border border-line rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <FilterPills filters={types} value={filter} onChange={setFilter} />

      {list.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="w-8 h-8 text-ghost mx-auto" strokeWidth={1.5} />}
          title={search ? 'No matching lab reports' : 'No lab reports yet'}
          sub={search ? 'Try adjusting your search or filters.' : 'Documents and lab reports uploaded by your doctor or hospital will appear here.'}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {list.map((r, idx) => (
            <button
              key={`${r.id}-${idx}`}
              onClick={() => setOpen(r)}
              className="bg-surface border border-line rounded-xl p-4 shadow-sm text-left hover:border-primary hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {r.fileData ? (
                    <img src={r.fileData} alt="" className="w-12 h-12 rounded-lg object-cover border border-line shrink-0 group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink truncate group-hover:text-primary transition-colors">{r.title}</p>
                    <p className="text-[12px] text-muted flex items-center gap-1.5 mt-0.5">
                      <span className="font-medium text-ink/80">{r.type}</span>
                      <span>·</span>
                      <span>{fmtD(r.date)}</span>
                    </p>
                    {(r.doctor || r.hospital) && (
                      <p className="text-[11px] text-muted/80 truncate mt-1">
                        {r.doctor ? r.doctor : ''}{r.doctor && r.hospital ? ' · ' : ''}{r.hospital ? r.hospital : ''}
                      </p>
                    )}
                  </div>
                </div>
                <StatusChip ok={r.verified} warn={!r.verified}>{r.verified ? 'Verified' : 'Pending'}</StatusChip>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title={open.title}
          onClose={() => setOpen(null)}
          icon={<FileText className="w-5 h-5 text-primary" strokeWidth={1.5} />}
        >
          {open.fileData && (
            <div className="relative group mb-4">
              <img src={open.fileData} alt={open.title} className="w-full max-h-[320px] object-contain rounded-lg border border-line bg-black/5" />
              <a
                href={open.fileData}
                download={`${open.title.replace(/\s+/g, '_')}_Report.png`}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-md text-xs font-medium flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" /> Download Scan
              </a>
            </div>
          )}

          <div className="space-y-3">
            <dl className="text-[13px] space-y-2 divide-y divide-line/60">
              {[
                ['Document Type', open.type],
                ['Date of Test', fmtD(open.date)],
                ['Hospital / Clinic', open.hospital],
                ['Attending Doctor', open.doctor],
                ['Uploaded By', (open.uploadedBy || '—') + (open.uploadedByRole ? ` (${open.uploadedByRole})` : '')],
                ['Uploaded On', fmtDT(open.createdAt)],
                ['Verification Status', open.verified ? 'Verified Official Record' : 'Awaiting Physician Verification'],
              ].map(([k, v], i) => v && (
                <div key={`${k}-${i}`} className="flex gap-2 pt-2 first:pt-0">
                  <dt className="w-[140px] shrink-0 text-muted font-medium">{k}</dt>
                  <dd className="text-ink font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            {open.note && (
              <div className="mt-4 p-3.5 rounded-lg bg-stripe border border-line space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Clinical & Laboratory Notes</span>
                <p className="text-[13px] text-ink whitespace-pre-line leading-relaxed">{open.note}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
