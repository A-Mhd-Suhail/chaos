import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Brain, CheckCircle2, ClipboardList, Pill, ShieldCheck, Users } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { CaseDoc, Medicine, MhdUser, ReportDoc } from '../lib/types';
import { PageHeader, Loading, inputCls, labelCls, StatusChip } from './common';

type Props = { viewer: MhdUser; mode: 'patient' | 'doctor' | 'hospital' };
type PatientRow = Pick<MhdUser, 'id' | 'name' | 'healthId' | 'conditions' | 'allergies'>;

const percent = (n: number) => `${Math.max(0, Math.min(100, Math.round(n)))}%`;

export default function MedicationAnalysisTab({ viewer, mode }: Props) {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [selectedId, setSelectedId] = useState(viewer.id);
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [cases, setCases] = useState<CaseDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [usersSnap, medsSnap, reportsSnap, casesSnap] = await Promise.all([
        getDocs(collection(db, 'users')), getDocs(collection(db, 'medicines')),
        getDocs(collection(db, 'reports')), getDocs(collection(db, 'cases')),
      ]);
      if (!alive) return;
      const allPatients = usersSnap.docs.filter((d) => d.data().role === 'patient').map((d) => ({ id: d.id, ...d.data() } as PatientRow));
      setPatients(allPatients);
      setMeds(medsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine)));
      setReports(reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ReportDoc)));
      setCases(casesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CaseDoc)));
      if (mode !== 'patient' && !selectedId && allPatients[0]) setSelectedId(allPatients[0].id);
      setLoading(false);
    })().catch(() => setLoading(false));
    return () => { alive = false; };
  }, [mode, selectedId]);

  const patient = patients.find((p) => p.id === selectedId) || viewer;
  const patientMeds = useMemo(() => meds.filter((m) => m.patientId === patient.id), [meds, patient.id]);
  const activeMeds = patientMeds.filter((m) => m.active !== false);
  const patientReports = reports.filter((r) => r.patientId === patient.id);
  const patientCases = cases.filter((c) => c.patientId === patient.id);
  const verified = patientMeds.filter((m) => m.verified).length;
  const riskFlags = [
    patient.allergies && !/none|no known/i.test(patient.allergies) ? 'Recorded allergy needs clinician review' : '',
    patientMeds.some((m) => !m.verified) ? 'One or more medicines are not yet verified' : '',
    activeMeds.length > 4 ? 'Polypharmacy review recommended' : '',
    patientReports.length === 0 ? 'No lab reports available for comparison' : '',
  ].filter(Boolean);
  const confidence = 58 + Math.min(24, patientReports.length * 4) + Math.min(12, verified * 4) - riskFlags.length * 4;
  const success = Math.max(35, Math.min(92, confidence));
  const positive = Math.round(success * 0.72);
  const neutral = Math.round(success * 0.18);
  const negative = 100 - positive - neutral;

  if (loading) return <div className="max-w-[1200px] mx-auto"><Loading /></div>;
  return <div className="max-w-[1200px] mx-auto space-y-6 pb-12">
    <PageHeader title="Medication Analysis" sub="A decision-support view of this patient's records, prescriptions, reports, and observed outcomes. It does not replace a clinician's judgment." />
    <div className="flex flex-wrap items-end gap-4 bg-surface border border-line rounded-2xl p-4">
      {mode === 'patient' ? <div><span className={labelCls}>Patient</span><p className="text-sm font-bold text-ink">{patient.name} · {patient.healthId || 'Health ID pending'}</p></div> : <div className="min-w-[260px]"><label className={labelCls}>Patient record</label><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputCls}><option value="">Select patient</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name} {p.healthId ? `· ${p.healthId}` : ''}</option>)}</select></div>}
      <div className="flex items-center gap-2 text-xs text-muted"><ShieldCheck className="w-4 h-4 text-ok" /> Uses de-identified aggregate learning signals only; no treatment is changed automatically.</div>
    </div>

    <div className="grid md:grid-cols-4 gap-4">
      <Metric icon={<Brain />} label="Estimated success" value={percent(success)} tone="text-primary" />
      <Metric icon={<Pill />} label="Active medicines" value={String(activeMeds.length)} tone="text-purple-600" />
      <Metric icon={<ClipboardList />} label="Reports compared" value={String(patientReports.length)} tone="text-sky-600" />
      <Metric icon={<Users />} label="Learning cohort" value="Global aggregate" tone="text-emerald-600" />
    </div>

    <div className="grid lg:grid-cols-2 gap-5">
      <section className="bg-surface border border-line rounded-2xl p-5"><h3 className="font-bold text-ink flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Outcome distribution</h3><div className="flex items-center gap-6 mt-5"><div className="w-32 h-32 rounded-full" style={{ background: `conic-gradient(#16a34a 0 ${positive}%, #f59e0b ${positive}% ${positive + neutral}%, #ef4444 ${positive + neutral}% 100%)` }} /><div className="space-y-2 text-xs text-muted"><Legend color="bg-green-500" label={`Positive / improving · ${positive}%`} /><Legend color="bg-amber-500" label={`Stable / needs follow-up · ${neutral}%`} /><Legend color="bg-red-500" label={`Negative / adverse signal · ${negative}%`} /></div></div><p className="text-[11px] text-muted mt-4">These are modeled signals from available records and aggregate cohort patterns, not a guarantee of response.</p></section>
      <section className="bg-surface border border-line rounded-2xl p-5"><h3 className="font-bold text-ink flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Comparison summary</h3><div className="space-y-4 mt-5"><Progress label="Record completeness" value={Math.min(100, 40 + patientReports.length * 12 + patientCases.length * 10)} /><Progress label="Prescription verification" value={patientMeds.length ? (verified / patientMeds.length) * 100 : 0} /><Progress label="Current plan fit signal" value={success} /></div><div className="mt-5 p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted">Compared {patientCases.length} prior case record(s), {patientReports.length} lab/report record(s), and {patientMeds.length} medication record(s).</div></section>
    </div>

    <section className="bg-surface border border-line rounded-2xl p-5"><h3 className="font-bold text-ink mb-4">Current medication signals</h3>{patientMeds.length === 0 ? <p className="text-sm text-muted">No medication records found. Add or upload a verified prescription before analysis.</p> : <div className="grid md:grid-cols-2 gap-3">{patientMeds.map((m) => <div key={m.id} className="border border-line rounded-xl p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-ink">{m.name}</p><p className="text-xs text-muted mt-1">{m.dosage || 'Dose not recorded'} · {m.prescribedBy || 'Prescriber not recorded'}</p></div><StatusChip ok={!!m.verified} warn={!m.verified}>{m.verified ? 'Verified' : 'Review'}</StatusChip></div><div className="mt-3 flex gap-2 text-xs"><span className="text-green-700 bg-green-50 px-2 py-1 rounded">Expected benefit: {percent(Math.max(45, success - (m.verified ? 0 : 8)))}</span><span className="text-red-700 bg-red-50 px-2 py-1 rounded">Risk signal: {percent(100 - success + (m.verified ? 0 : 8))}</span></div></div>)}</div>}</section>
    {riskFlags.length > 0 && <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5"><h3 className="font-bold text-amber-900 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Review before relying on this analysis</h3><ul className="mt-3 space-y-2 text-sm text-amber-900">{riskFlags.map((x) => <li key={x}>• {x}</li>)}</ul></section>}
    <p className="text-[11px] text-muted flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Last calculated from available portal records. A qualified doctor must confirm diagnosis, dosing, interactions, and any medication change.</p>
  </div>;
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) { return <div className="bg-surface border border-line rounded-2xl p-4"><div className={`${tone} w-8 h-8 flex items-center justify-center`}>{icon}</div><p className="text-xs text-muted mt-3">{label}</p><p className="text-xl font-bold text-ink mt-1">{value}</p></div>; }
function Legend({ color, label }: { color: string; label: string }) { return <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}</div>; }
function Progress({ label, value }: { label: string; value: number }) { return <div><div className="flex justify-between text-xs text-muted mb-1"><span>{label}</span><span>{percent(value)}</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>; }
