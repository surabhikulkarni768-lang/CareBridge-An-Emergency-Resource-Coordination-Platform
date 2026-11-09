import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Activity,
  Heart,
  FileText,
  User,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  Building2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataService';
import type { EmergencyCase, ClinicalNote } from '../../types';

export const DoctorDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<EmergencyCase | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [bp, setBp] = useState('140/90');
  const [pulse, setPulse] = useState('98 bpm');
  const [spO2, setSpO2] = useState('94%');
  const [temp, setTemp] = useState('98.6 °F');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = () => {
    const allCases = dataStore.getCases();
    setCases(allCases);
    if (!selectedCase && allCases.length > 0) {
      setSelectedCase(allCases[0]);
    }
    if (selectedCase) {
      setClinicalNotes(dataStore.getClinicalNotes(selectedCase.caseId));
    }
  };

  useEffect(() => {
    loadData();
    const unsub = dataStore.subscribe(loadData);
    return () => unsub();
  }, [currentUser, selectedCase?.caseId]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !currentUser || !newNoteText.trim()) return;

    const note: ClinicalNote = {
      id: 'note-' + Date.now(),
      caseId: selectedCase.caseId,
      doctorUid: currentUser.uid,
      doctorName: currentUser.displayName,
      hospitalName: currentUser.hospitalAffiliation || 'KIMS Super Specialty Hospital',
      noteText: newNoteText.trim(),
      vitals: { bp, pulse, spO2, temp },
      createdAt: new Date().toISOString()
    };

    dataStore.addClinicalNote(note);
    setNewNoteText('');
    setSuccessMessage('Clinical evaluation note attached to emergency case record.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
            <Stethoscope className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{currentUser?.displayName}</h1>
              <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Attending Physician
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Affiliation: <strong className="text-slate-700">{currentUser?.hospitalAffiliation || 'KIMS Super Specialty Hospital'}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 self-end sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* Main Grid: Cases List + Detail/Notes Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Active Emergency Patients ({cases.length})
          </h2>
          <div className="space-y-2">
            {cases.map((c) => (
              <div
                key={c.caseId}
                onClick={() => setSelectedCase(c)}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-left space-y-1.5 ${
                  selectedCase?.caseId === c.caseId
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{c.patientName}</span>
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      c.urgencyLevel === 'immediate'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {c.urgencyLevel}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">{c.caseId}</div>
                <p className="text-xs text-slate-600 line-clamp-1 italic">{c.conditionSummary}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Case Clinical Workspace */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCase ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
              {/* Patient Banner */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCase.patientName}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>Age: <strong>{selectedCase.patientAge}</strong></span>
                    <span>Gender: <strong>{selectedCase.patientGender}</strong></span>
                    <span>Incident: <strong>{selectedCase.location.address}</strong></span>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                  {selectedCase.caseId}
                </span>
              </div>

              {/* Triage Condition */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-1 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Triage Condition & Symptoms</span>
                <p className="text-slate-800 font-medium italic">{selectedCase.conditionSummary}</p>
              </div>

              {/* Add Clinical Examination Note */}
              <form onSubmit={handleAddNote} className="space-y-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50/20">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" /> Record Attending Clinical Vitals & Notes
                </h4>

                {/* Vitals Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-0.5">Blood Pressure</label>
                    <input
                      type="text"
                      value={bp}
                      onChange={(e) => setBp(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-0.5">Heart Rate</label>
                    <input
                      type="text"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-0.5">SpO2 Oxygen</label>
                    <input
                      type="text"
                      value={spO2}
                      onChange={(e) => setSpO2(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-0.5">Body Temp</label>
                    <input
                      type="text"
                      value={temp}
                      onChange={(e) => setTemp(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Doctor Note */}
                <div>
                  <label className="text-slate-600 block mb-0.5 text-xs">Clinical Impression & Treatment Orders</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="E.g., Patient admitted to ICU Bed #4. Started on continuous telemetry and dual antiplatelet therapy..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 ml-auto"
                >
                  <Send className="w-3.5 h-3.5" /> Save to Electronic Health Record
                </button>
              </form>

              {/* Past Notes for this case */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Case Medical Timeline ({clinicalNotes.length})
                </h4>
                {clinicalNotes.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    No clinical physician notes recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clinicalNotes.map((note) => (
                      <div key={note.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="font-bold text-slate-800">{note.doctorName} ({note.hospitalName})</span>
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 font-medium leading-relaxed">{note.noteText}</p>
                        {note.vitals && (
                          <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                            <span>BP: <strong>{note.vitals.bp}</strong></span>
                            <span>Pulse: <strong>{note.vitals.pulse}</strong></span>
                            <span>SpO2: <strong>{note.vitals.spO2}</strong></span>
                            <span>Temp: <strong>{note.vitals.temp}</strong></span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">Select an emergency case to examine.</div>
          )}
        </div>
      </div>
    </div>
  );
};

