/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { app, auth, db } from './config/firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { LandingPage } from './components/landing/LandingPage';
import { AuthPage } from './components/auth/AuthPage';
import { HospitalDashboard } from './components/hospital/HospitalDashboard';
import { BloodBankDashboard } from './components/blood/BloodBankDashboard';
import { OxygenDashboard } from './components/oxygen/OxygenDashboard';
import { AmbulanceDashboard } from './components/ambulance/AmbulanceDashboard';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import {
  dataStore,
  fetchPatientLinksFromFirestore,
  savePatientLinkToFirestore,
  deletePatientLinkFromFirestore,
  fetchCasesForAttendantFromFirestore,
  saveCaseToFirestore,
  fetchRequestsForCasesFromFirestore,
  subscribePatientLinksFromFirestore,
  subscribeCasesForAttendantFromFirestore
} from './services/dataService';
import type { PatientLink, ResourceRequest as DataResourceRequest, EmergencyCategory, EmergencyPriority } from './types';
import {
  Heart,
  Activity,
  Check,
  Search,
  MapPin,
  Lock,
  User,
  Users,
  UserPlus,
  Trash2,
  X,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Phone,
  Clock,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  Home,
  CheckCheck,
  Building2,
  Bell,
  History,
  Settings,
  Layers,
  PlusCircle
} from 'lucide-react';

// ==========================================
// 1. REUSABLE CUSTOM MEDICAL ILLUSTRATION ICONS
// Designed to match the exact illustrations in the approved screenshots
// ==========================================

// CareBridge Official Logo Icon
function CareBridgeLogoIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="18" r="6" fill="#0E7490" />
      <circle cx="32" cy="18" r="6" fill="#0284C7" />
      <circle cx="24" cy="11" r="5" fill="#00707E" />
      <path
        d="M10 36C10 29.3726 15.3726 24 22 24H26C32.6274 24 38 29.3726 38 36C38 37.1046 37.1046 38 36 38H12C10.8954 38 10 37.1046 10 36Z"
        fill="#0F4C81"
      />
      <path
        d="M17 38C17 34.134 20.134 31 24 31C27.866 31 31 34.134 31 38"
        stroke="#E0F2FE"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Icon: Hospital Beds (Patient lying down with IV drip)
function HospitalBedIcon({ isSelected = false }: { isSelected?: boolean }) {
  const primary = isSelected ? '#FFFFFF' : '#00707E';
  const secondary = isSelected ? '#BAE6FD' : '#38BDF8';
  return (
    <svg viewBox="0 0 80 60" fill="none" className="w-16 h-12" xmlns="http://www.w3.org/2000/svg">
      {/* Bed frame */}
      <rect x="18" y="32" width="54" height="6" rx="2" fill={primary} />
      <rect x="16" y="24" width="4" height="24" rx="2" fill={primary} />
      <rect x="70" y="28" width="4" height="20" rx="2" fill={primary} />
      {/* Mattress */}
      <rect x="20" y="27" width="50" height="6" rx="2" fill={secondary} />
      {/* Patient */}
      <circle cx="30" cy="22" r="4.5" fill="#FBBF24" />
      <path d="M26 26.5C28 26 34 26 36 27C38 28 46 29 50 29" stroke={primary} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M35 29C35 29 44 28 58 29" fill="#10B981" />
      {/* IV Drip stand */}
      <path d="M10 12V48M7 12H13M10 15V18" stroke={primary} strokeWidth="2" strokeLinecap="round" />
      <rect x="8" y="16" width="4" height="7" rx="1.5" fill="#EF4444" />
      <path d="M10 23C10 26 15 28 26 27" stroke={secondary} strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  );
}

// Icon: ICU Facilities (Monitor with waveform & IV pump and bed)
function IcuFacilityIcon({ isSelected = false }: { isSelected?: boolean }) {
  const primary = isSelected ? '#FFFFFF' : '#00707E';
  const secondary = isSelected ? '#BAE6FD' : '#38BDF8';
  return (
    <svg viewBox="0 0 80 60" fill="none" className="w-16 h-12" xmlns="http://www.w3.org/2000/svg">
      {/* Bed */}
      <rect x="18" y="34" width="54" height="5" rx="2" fill={primary} />
      <rect x="16" y="28" width="4" height="18" rx="2" fill={primary} />
      <rect x="70" y="30" width="4" height="16" rx="2" fill={primary} />
      <rect x="20" y="30" width="49" height="5" rx="2" fill={secondary} />
      {/* Patient pillow & inclined bed */}
      <path d="M20 30L32 23H40" stroke={primary} strokeWidth="3" strokeLinecap="round" />
      {/* ICU Vital Sign Monitor */}
      <rect x="18" y="6" width="22" height="15" rx="2" fill={primary} />
      <rect x="20" y="8" width="18" height="11" rx="1" fill="#042F2E" />
      <path d="M22 13.5H25L26.5 10L28.5 16.5L30.5 12L32 13.5H36" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M29 21V28" stroke={primary} strokeWidth="2" />
      {/* Infusion Pumps Pole */}
      <path d="M60 8V34" stroke={primary} strokeWidth="2" />
      <rect x="56" y="11" width="8" height="6" rx="1" fill={secondary} />
      <rect x="56" y="19" width="8" height="6" rx="1" fill={secondary} />
    </svg>
  );
}

// Icon: Blood Component (Red blood droplet with white medical cross)
function BloodDropIcon({ isSelected = false }: { isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 60 60" fill="none" className="w-14 h-12" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M30 6C30 6 12 24 12 36C12 45.9411 20.0589 54 30 54C39.9411 54 48 45.9411 48 36C48 24 30 6 30 6Z"
        fill="#DC2626"
      />
      <path
        d="M26 24C26 24 17 33 17 39C17 41.5 18 44 20 46"
        stroke="#FCA5A5"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* White cross */}
      <rect x="27.5" y="30" width="5" height="15" rx="1.5" fill="#FFFFFF" />
      <rect x="22.5" y="35" width="15" height="5" rx="1.5" fill="#FFFFFF" />
    </svg>
  );
}

// Icon: Oxygen Tank (Green cylinder with pressure gauge, tubing, and cross)
function OxygenTankIcon({ isSelected = false }: { isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 60 60" fill="none" className="w-14 h-12" xmlns="http://www.w3.org/2000/svg">
      {/* Cylinder body */}
      <rect x="22" y="18" width="18" height="34" rx="9" fill="#10B981" />
      <rect x="24" y="20" width="14" height="30" rx="7" fill="#059669" />
      {/* Cap & neck */}
      <rect x="27" y="11" width="8" height="8" rx="2" fill="#64748B" />
      <rect x="29" y="8" width="4" height="4" fill="#475569" />
      {/* Pressure gauge */}
      <circle cx="38" cy="13" r="4.5" fill="#F8FAFC" stroke="#475569" strokeWidth="1.5" />
      <path d="M38 13L39.5 11.5" stroke="#DC2626" strokeWidth="1.2" strokeLinecap="round" />
      {/* White cross badge */}
      <rect x="29" y="29" width="4" height="12" rx="1" fill="#FFFFFF" />
      <rect x="25" y="33" width="12" height="4" rx="1" fill="#FFFFFF" />
      {/* Tubing */}
      <path d="M42 14C47 16 48 23 45 28" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Icon: Ambulance Vehicle (Clean emergency van with red cross and beacon)
function AmbulanceVehicleIcon({ isSelected = false }: { isSelected?: boolean }) {
  return (
    <svg viewBox="0 0 80 50" fill="none" className="w-18 h-12" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <path
        d="M12 34V16C12 14.8954 12.8954 14 14 14H52V34H12Z"
        fill="#FFFFFF"
        stroke="#334155"
        strokeWidth="2"
      />
      {/* Cabin */}
      <path
        d="M52 18H62C63.5 18 67 21 69 24L71 30C71.5 31.5 71 34 69 34H52V18Z"
        fill="#FFFFFF"
        stroke="#334155"
        strokeWidth="2"
      />
      {/* Windshield */}
      <path d="M54 20H61C62.5 20 64.5 22 66 25L67 28H54V20Z" fill="#38BDF8" />
      {/* Stripe */}
      <rect x="12" y="27" width="40" height="4" fill="#DC2626" />
      {/* Red cross on side */}
      <rect x="28" y="17" width="4" height="10" fill="#DC2626" />
      <rect x="25" y="20" width="10" height="4" fill="#DC2626" />
      {/* Emergency roof beacon */}
      <rect x="36" y="11" width="8" height="3" rx="1.5" fill="#EF4444" />
      {/* Wheels */}
      <circle cx="24" cy="35" r="6" fill="#1E293B" />
      <circle cx="24" cy="35" r="2.5" fill="#94A3B8" />
      <circle cx="58" cy="35" r="6" fill="#1E293B" />
      <circle cx="58" cy="35" r="2.5" fill="#94A3B8" />
    </svg>
  );
}

// Stethoscope illustration for Login Card
function StethoscopeIllustration() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#E0F2FE" />
        {/* Stethoscope tube */}
        <path
          d="M23 16V28C23 34 28 38 34 38C40 38 45 34 45 28V16"
          stroke="#00707E"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M34 38V44C34 47 37 49 40 47L43 45" stroke="#00707E" strokeWidth="3" strokeLinecap="round" />
        <circle cx="45" cy="44" r="4.5" fill="#0F4C81" stroke="#BAE6FD" strokeWidth="1.5" />
        {/* Red cross heart */}
        <circle cx="47" cy="18" r="8" fill="#EF4444" />
        <rect x="45.5" y="13" width="3" height="10" rx="1" fill="white" />
        <rect x="42" y="16.5" width="10" height="3" rx="1" fill="white" />
        <circle cx="21" cy="16" r="2.5" fill="#0F4C81" />
      </svg>
    </div>
  );
}

// Medical Clipboard illustration for Register Card
function MedicalClipboardIllustration() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#E6F4F6" />
        {/* Clipboard */}
        <rect x="18" y="14" width="28" height="36" rx="4" fill="#FFFFFF" stroke="#00707E" strokeWidth="2.5" />
        <rect x="25" y="11" width="14" height="6" rx="2" fill="#0F4C81" />
        {/* Lines */}
        <line x1="24" y1="26" x2="38" y2="26" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        <line x1="24" y1="32" x2="40" y2="32" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        <line x1="24" y1="38" x2="34" y2="38" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        {/* Heart badge with pulse */}
        <circle cx="44" cy="42" r="9" fill="#DC2626" />
        <path
          d="M39 42H41.5L42.5 39.5L44.5 44.5L46 41L47 42H49"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ==========================================
// 2. MAIN APPLICATION COMPONENT
// ==========================================

export interface ResourceStatusItem {
  resource: string;
  status: string;
  code: 'pending' | 'dispatched' | 'reserved' | 'in-review' | 'completed';
  detail: string;
  updatedAt: string;
}

export interface EmergencyCase {
  caseId: string;
  status: 'Active' | 'Dispatched' | 'Under Review' | 'Completed';
  createdAt: string;
  dateStr: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientBloodGroup: string;
  patientCondition: string;
  attendantName: string;
  attendantRelation: string;
  attendantPhone: string;
  incidentAddress: string;
  triagePriority: 'immediate' | 'emergency' | 'urgent' | 'semi-urgent';
  emergencyDescription: string;
  providerName: string;
  providerDetails: string;
  providerRating: string;
  resourcesList: string[];
  individualStatuses: ResourceStatusItem[];
}

function CareBridgeApp() {
  const { currentUser, activeRole, loading, logout } = useAuth();

  // Navigation: 'landing' | 'login' | 'signup' | 'forgot' | 'selection' | 'case-details' | 'case-confirmation' | 'dashboard'
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'login' | 'signup' | 'forgot' | 'selection' | 'case-details' | 'case-confirmation' | 'dashboard'>('landing');

  // Returning user session restoration:
  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        // Authenticated user arriving or restoring session -> show role dashboard
        if (currentScreen === 'landing' || currentScreen === 'login' || currentScreen === 'signup' || currentScreen === 'forgot') {
          setCurrentScreen('dashboard');
        }
      } else {
        // Unauthenticated visitor: if attempting to view a dashboard, redirect to landing
        if (currentScreen === 'dashboard') {
          setCurrentScreen('landing');
        }
      }
    }
  }, [currentUser, loading]);

  // Task 2 verification: confirm Firebase module initialization in dev/runtime
  useEffect(() => {
    if (app && db && auth) {
      console.log('[CareBridge App] Firebase module successfully connected:', {
        appName: app.name,
        authReady: Boolean(auth),
        firestoreReady: Boolean(db),
      });
    }
  }, []);

  // Screen B (Selection) State - hydrated from localStorage if available
  const [selectedResources, setSelectedResources] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('carebridge_selected_resources');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
    return { beds: true, icu: true, blood: true, oxygen: true, ambulance: true };
  });

  const [searchLocation, setSearchLocation] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('carebridge_location');
      if (saved) return saved;
    } catch (e) {}
    return 'Hubballi, Karnataka, India';
  });

  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('carebridge_provider_id');
      if (saved) return saved;
    } catch (e) {}
    return 'prov-01';
  });

  // Toggle resource in Screen B and persist
  const toggleResource = (key: string) => {
    setSelectedResources((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('carebridge_selected_resources', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleSelectProvider = (id: string) => {
    setSelectedProviderId(id);
    try {
      localStorage.setItem('carebridge_provider_id', id);
    } catch (e) {}
  };

  const handleUpdateLocation = (loc: string) => {
    setSearchLocation(loc);
    try {
      localStorage.setItem('carebridge_location', loc);
    } catch (e) {}
  };

  // Screen C (Emergency Case Details) Form State
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [patientBloodGroup, setPatientBloodGroup] = useState('Unknown');
  const [patientCondition, setPatientCondition] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [attendantRelation, setAttendantRelation] = useState('Attendant');
  const [attendantPhone, setAttendantPhone] = useState('');
  const [incidentAddress, setIncidentAddress] = useState('Hubballi, Karnataka');
  const [triagePriority, setTriagePriority] = useState<'immediate' | 'emergency' | 'urgent' | 'semi-urgent'>('immediate');
  const [emergencyPriority, setEmergencyPriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('Critical');
  const [emergencyCategory, setEmergencyCategory] = useState<EmergencyCategory>('General Acute Medical');
  const [bloodUnitsRequired, setBloodUnitsRequired] = useState('2');
  const [oxygenQuantityRequired, setOxygenQuantityRequired] = useState('2');
  const [ambulanceTypeRequired, setAmbulanceTypeRequired] = useState<'ALS' | 'BLS' | 'Patient Transport'>('ALS');
  const [emergencyDescription, setEmergencyDescription] = useState('');
  const [isSubmittingEmergency, setIsSubmittingEmergency] = useState(false);

  // Linked Patients State for Attendants
  const [linkedPatients, setLinkedPatients] = useState<PatientLink[]>([]);
  const [selectedLinkedPatientId, setSelectedLinkedPatientId] = useState<string>('');
  const [isLinkPatientModalOpen, setIsLinkPatientModalOpen] = useState(false);

  // New Patient Link Form Fields
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientRelation, setNewPatientRelation] = useState('Parent');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientGender, setNewPatientGender] = useState('Male');
  const [newPatientBloodGroup, setNewPatientBloodGroup] = useState('Unknown');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientNotes, setNewPatientNotes] = useState('');
  const [newPatientUid, setNewPatientUid] = useState('');
  const [newPatientConsent, setNewPatientConsent] = useState(true);
  const [linkPatientErrors, setLinkPatientErrors] = useState<Record<string, string>>({});
  const [isLinkingSubmitting, setIsLinkingSubmitting] = useState(false);
  const [linkingSuccessMsg, setLinkingSuccessMsg] = useState<string | null>(null);

  // Validation & Submission States - hydrated from localStorage if available
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submittedCase, setSubmittedCase] = useState<EmergencyCase | null>(null);

  // Resource requests associated with active cases
  const [requestsList, setRequestsList] = useState<DataResourceRequest[]>([]);

  // Multi-case list for Patient/Attendant Emergency Dashboard
  // NOTE: Initialized to empty array so real authenticated users (like Sahana S.)
  // never see hardcoded demo cases from other users.
  const [casesList, setCasesList] = useState<EmergencyCase[]>([]);

  // Dashboard Tab State: 'cases' | 'track' | 'patients' | 'notifications' | 'history' | 'profile'
  const [dashboardTab, setDashboardTab] = useState<'cases' | 'track' | 'patients' | 'notifications' | 'history' | 'profile'>('cases');
  const [selectedDashboardCase, setSelectedDashboardCase] = useState<EmergencyCase | null>(null);

  // Effect: Sync authenticated attendant profile & fetch their authorized linked patients and cases
  useEffect(() => {
    if (!currentUser) {
      setCasesList([]);
      setLinkedPatients([]);
      setRequestsList([]);
      return;
    }

    let isMounted = true;

    // Populate default attendant details from authenticated user
    setAttendantName(currentUser.displayName || '');
    setAttendantPhone(currentUser.phone || '');

    const loadAttendantData = async () => {
      try {
        // 1. Fetch authorized patient links for this attendant
        const links = await fetchPatientLinksFromFirestore(currentUser.uid);
        if (!isMounted) return;
        setLinkedPatients(links);

        const linkedPatientUids = links.map((l) => l.patientUid);

        // 2. Fetch emergency cases strictly for this attendant and their authorized linked patients
        const authorizedCases = await fetchCasesForAttendantFromFirestore(currentUser.uid, linkedPatientUids);
        if (!isMounted) return;

        // Map to EmergencyCase view objects
        const formatted: EmergencyCase[] = authorizedCases.map((c) => ({
          caseId: c.caseId,
          status: (c.status === 'resolved' || c.status === 'cancelled' ? 'Completed' : 'Active') as any,
          createdAt: new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateStr: new Date(c.createdAt).toLocaleDateString(),
          patientName: c.patientName,
          patientAge: String(c.patientAge || ''),
          patientGender: c.patientGender || 'Unknown',
          patientBloodGroup: c.patientBloodGroup || 'Unknown',
          patientCondition: c.conditionSummary,
          attendantName: c.attendant?.name || currentUser.displayName || 'Sahana S.',
          attendantRelation: c.attendant?.relation || 'Attendant',
          attendantPhone: c.attendant?.phone || currentUser.phone || '',
          incidentAddress: c.location?.address || 'Hubballi',
          triagePriority: c.urgencyLevel,
          emergencyDescription: c.conditionSummary,
          providerName: 'CareBridge Emergency Network',
          providerDetails: 'Verified Emergency Response Network',
          providerRating: '4.9 Stars',
          resourcesList: (c.resourcesNeeded || []).map((r) =>
            r === 'bed'
              ? 'Hospital Beds'
              : r === 'icu'
              ? 'ICU Facilities'
              : r === 'blood'
              ? 'Blood'
              : r === 'oxygen'
              ? 'Oxygen'
              : 'Ambulance Services'
          ),
          individualStatuses: []
        }));

        setCasesList(formatted);

        // 3. Fetch resource requests for these authorized cases
        const caseIds = authorizedCases.map((c) => c.caseId);
        const reqs = await fetchRequestsForCasesFromFirestore(caseIds);
        if (!isMounted) return;
        setRequestsList(reqs);
      } catch (err) {
        console.error('[CareBridge] Error loading attendant data:', err);
      }
    };

    loadAttendantData();

    // Set up real-time Firestore onSnapshot listener for patient links
    const unsubLinks = subscribePatientLinksFromFirestore(currentUser.uid, (links) => {
      if (!isMounted) return;
      setLinkedPatients(links);
    });

    // Set up real-time Firestore onSnapshot listener for emergency cases
    const unsubCases = subscribeCasesForAttendantFromFirestore(currentUser.uid, [], (cases) => {
      if (!isMounted) return;
      if (cases.length > 0) {
        const formatted: EmergencyCase[] = cases.map((c) => ({
          caseId: c.caseId,
          status: (c.status === 'resolved' || c.status === 'cancelled' ? 'Completed' : 'Active') as any,
          createdAt: new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateStr: new Date(c.createdAt).toLocaleDateString(),
          patientName: c.patientName,
          patientAge: String(c.patientAge || ''),
          patientGender: c.patientGender || 'Unknown',
          patientBloodGroup: c.patientBloodGroup || 'Unknown',
          patientCondition: c.conditionSummary,
          attendantName: c.attendant?.name || currentUser.displayName || 'Sahana S.',
          attendantRelation: c.attendant?.relation || 'Attendant',
          attendantPhone: c.attendant?.phone || currentUser.phone || '',
          incidentAddress: c.location?.address || 'Hubballi',
          triagePriority: c.urgencyLevel,
          emergencyDescription: c.conditionSummary,
          providerName: 'CareBridge Emergency Network',
          providerDetails: 'Verified Emergency Response Network',
          providerRating: '4.9 Stars',
          resourcesList: (c.resourcesNeeded || []).map((r) =>
            r === 'bed'
              ? 'Hospital Beds'
              : r === 'icu'
              ? 'ICU Facilities'
              : r === 'blood'
              ? 'Blood'
              : r === 'oxygen'
              ? 'Oxygen'
              : 'Ambulance Services'
          ),
          individualStatuses: []
        }));
        setCasesList(formatted);
      }
    });

    return () => {
      isMounted = false;
      unsubLinks();
      unsubCases();
    };
  }, [currentUser]);

  const [copiedCaseId, setCopiedCaseId] = useState(false);
  const [isViewCaseModalOpen, setIsViewCaseModalOpen] = useState(false);

  // Provider Directory Lookup
  const PROVIDERS: Record<string, { name: string; details: string; rating: string; phone: string; address: string }> = {
    'prov-01': {
      name: "St. Luke's Medical Center",
      details: '5 Hospital Beds, 2 ICU',
      rating: '4.8 Stars',
      phone: '+91 836 225 1100',
      address: 'Vidyanagar, Hubballi, Karnataka 580021'
    },
    'prov-02': {
      name: 'City General Hospital',
      details: '2 Hospital Beds, 1 ICU, 15 Units B+ Blood, 10 Oxygen Tanks',
      rating: '4.5 Stars',
      phone: '+91 836 237 4422',
      address: 'PB Road, Hubballi, Karnataka 580029'
    },
    'prov-03': {
      name: 'Paramount Ambulance Service',
      details: '3 Ambulances',
      rating: '4.9 Stars',
      phone: '+91 836 299 9108',
      address: 'Station Road, Hubballi, Karnataka 580020'
    }
  };

  // Validate and submit emergency case
  const handleSubmitCase = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errors: Record<string, string> = {};

    if (!patientName.trim()) {
      errors.patientName = 'Patient full name is required';
    }
    if (!patientAge.trim() || isNaN(Number(patientAge)) || Number(patientAge) <= 0 || Number(patientAge) > 125) {
      errors.patientAge = 'Please enter a valid patient age (1–125)';
    }
    if (!patientGender) {
      errors.patientGender = 'Gender is required';
    }
    if (!patientCondition.trim()) {
      errors.patientCondition = 'Primary condition or complaint is required';
    }
    if (!attendantName.trim()) {
      errors.attendantName = 'Attendant full name is required';
    }
    if (!attendantPhone.trim() || attendantPhone.trim().length < 8) {
      errors.attendantPhone = 'Please enter a valid contact phone number';
    }
    if (!incidentAddress.trim()) {
      errors.incidentAddress = 'Incident address / landmark is required';
    }
    if (!emergencyDescription.trim()) {
      errors.emergencyDescription = 'Please describe the emergency condition';
    }

    // Active resources list
    const activeResources = Object.entries(selectedResources)
      .filter(([_, val]) => val)
      .map(([key]) => {
        switch (key) {
          case 'beds': return 'Hospital Beds';
          case 'icu': return 'ICU Facilities';
          case 'blood': return 'Blood';
          case 'oxygen': return 'Oxygen';
          case 'ambulance': return 'Ambulance Services';
          default: return key;
        }
      });

    if (activeResources.length === 0) {
      errors.resources = 'Please select at least one emergency resource';
    }

    // Enforce attendant consent check if an attendant is submitting for a patient
    const isAttendantRole = currentUser?.role === 'patientAttendant' || currentUser?.role === 'patient_attendant' || currentUser?.role === 'attendant';
    if (isAttendantRole && linkedPatients.length > 0) {
      const activeLinked = linkedPatients.find(l => l.id === selectedLinkedPatientId) || linkedPatients[0];
      if (activeLinked && (!activeLinked.consentGranted || activeLinked.consentStatus !== 'granted')) {
        errors.consent = 'Valid patient consent is required before submitting an emergency request on behalf of this patient.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (isSubmittingEmergency) return;
    setIsSubmittingEmergency(true);
    setFormErrors({});

    const todayDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newCaseId = `EMG-${todayDate}-${randomSuffix}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const currentProvider = PROVIDERS[selectedProviderId] || PROVIDERS['prov-01'];

    // Construct individual request statuses for each selected resource
    const individualStatuses = activeResources.map((res) => {
      if (res === 'Hospital Beds') {
        return {
          resource: 'Hospital Beds',
          status: 'Pending Bed Allocation',
          code: 'pending' as const,
          detail: 'Emergency room notified • Inpatient triage bed reservation initiated',
          updatedAt: 'Just now'
        };
      }
      if (res === 'ICU Facilities') {
        return {
          resource: 'ICU Facilities',
          status: 'Under Clinical Review',
          code: 'in-review' as const,
          detail: 'ICU Intensivist reviewing triage notes & vital stability',
          updatedAt: 'Just now'
        };
      }
      if (res === 'Blood') {
        return {
          resource: 'Blood Units',
          status: 'Cross-Match Requested',
          code: 'in-review' as const,
          detail: `Requisition sent for ${bloodUnitsRequired || 2} units of ${patientBloodGroup || 'B+'} blood`,
          updatedAt: 'Just now'
        };
      }
      if (res === 'Oxygen') {
        return {
          resource: 'Oxygen Supply',
          status: 'Reserved & Staged',
          code: 'reserved' as const,
          detail: `High-flow oxygen allocation (${oxygenQuantityRequired || 2} cylinders)`,
          updatedAt: 'Just now'
        };
      }
      // Ambulance
      return {
        resource: 'Ambulance Services',
        status: 'Dispatched • En Route',
        code: 'dispatched' as const,
        detail: `Unit ${ambulanceTypeRequired || 'ALS'} paramedic vehicle dispatched • Estimated ETA: 8 minutes`,
        updatedAt: 'Just now'
      };
    });

    const newCaseData: EmergencyCase = {
      caseId: newCaseId,
      status: 'REQUESTED' as any,
      createdAt: nowTime,
      dateStr: nowDateStr,
      patientName: patientName.trim(),
      patientAge: patientAge.trim(),
      patientGender,
      patientBloodGroup,
      patientCondition: patientCondition.trim(),
      attendantName: attendantName.trim(),
      attendantRelation,
      attendantPhone: attendantPhone.trim(),
      incidentAddress: incidentAddress.trim(),
      triagePriority,
      emergencyDescription: emergencyDescription.trim(),
      providerName: currentProvider.name,
      providerDetails: currentProvider.details,
      providerRating: currentProvider.rating,
      resourcesList: activeResources,
      individualStatuses
    };

    setSubmittedCase(newCaseData);
    setCasesList((prev) => {
      const updated = [newCaseData, ...prev.filter((c) => c.caseId !== newCaseData.caseId)];
      try {
        localStorage.setItem('carebridge_cases_list', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    try {
      localStorage.setItem('carebridge_active_case', JSON.stringify(newCaseData));
    } catch (e) {}

    // Determine target patient UID based on selected linked patient or current user
    const linkedMatch = linkedPatients.find(
      (l) => l.id === selectedLinkedPatientId || l.patientName.toLowerCase() === patientName.trim().toLowerCase()
    );
    const assignedPatientUid = linkedMatch ? linkedMatch.patientUid : (currentUser?.uid || 'patient-demo-01');

    // Synchronize with unified CareBridge DataStore and Firestore
    try {
      const caseRecord: EmergencyCase = {
        caseId: newCaseId,
        patientUid: assignedPatientUid,
        attendantUid: currentUser?.uid,
        patientName: patientName.trim(),
        patientAge: Number(patientAge.trim()) || 40,
        patientGender,
        patientBloodGroup,
        category: emergencyCategory,
        conditionSummary: patientCondition.trim(),
        urgencyLevel: triagePriority,
        priority: emergencyPriority,
        resourcesNeeded: activeResources,
        quotas: {
          bedRequired: Boolean(selectedResources.beds),
          icuRequired: Boolean(selectedResources.icu),
          bloodRequired: Boolean(selectedResources.blood),
          bloodGroup: patientBloodGroup,
          bloodUnits: Number(bloodUnitsRequired) || 2,
          oxygenRequired: Boolean(selectedResources.oxygen),
          oxygenType: 'cylinder',
          oxygenQuantity: Number(oxygenQuantityRequired) || 2,
          ambulanceRequired: Boolean(selectedResources.ambulance),
          ambulanceType: ambulanceTypeRequired
        },
        location: {
          city: 'Hubballi',
          address: incidentAddress.trim(),
          state: 'Karnataka'
        },
        contactPhone: attendantPhone.trim() || currentUser?.phone || '',
        attendant: {
          uid: currentUser?.uid,
          name: attendantName.trim() || currentUser?.displayName || 'Sahana S.',
          relation: attendantRelation,
          phone: attendantPhone.trim() || currentUser?.phone || ''
        },
        status: 'REQUESTED',
        requestCount: activeResources.length,
        auditHistory: [
          {
            id: 'audit-' + Date.now(),
            status: 'REQUESTED',
            updatedByUid: currentUser?.uid || assignedPatientUid,
            updatedByName: currentUser?.displayName || attendantName.trim() || 'Patient/Attendant',
            role: currentUser?.role || 'patient',
            timestamp: new Date().toISOString(),
            note: `Emergency request initiated with priority: ${emergencyPriority}. Triage category: ${emergencyCategory}.`
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      dataStore.createCase(caseRecord);
      saveCaseToFirestore(caseRecord);

      if (selectedResources.beds || selectedResources.icu) {
        dataStore.createRequest({
          requestId: 'REQ-' + Date.now().toString().slice(-6) + '-1',
          caseId: newCaseId,
          patientUid: currentUser?.uid || 'patient-demo-01',
          patientName: patientName.trim(),
          providerUid: 'hosp-demo-01',
          providerName: currentProvider.name || 'KIMS Super Specialty Hospital',
          resourceType: 'bed',
          details: { bedType: selectedResources.icu ? 'ICU Bed' : 'General Emergency Bed', notes: emergencyDescription },
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      if (selectedResources.blood) {
        dataStore.createRequest({
          requestId: 'REQ-' + Date.now().toString().slice(-6) + '-2',
          caseId: newCaseId,
          patientUid: currentUser?.uid || 'patient-demo-01',
          patientName: patientName.trim(),
          providerUid: 'blood-demo-01',
          providerName: 'Red Cross Regional Blood Centre',
          resourceType: 'blood',
          details: { bloodGroup: patientBloodGroup, units: 2, notes: 'Emergency transfusion requirement' },
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      if (selectedResources.oxygen) {
        dataStore.createRequest({
          requestId: 'REQ-' + Date.now().toString().slice(-6) + '-3',
          caseId: newCaseId,
          patientUid: currentUser?.uid || 'patient-demo-01',
          patientName: patientName.trim(),
          providerUid: 'oxy-demo-01',
          providerName: 'OxyLife Medical Gas Distributors',
          resourceType: 'oxygen',
          details: { cylinders: 2, concentrators: 0, notes: 'High-flow oxygen support' },
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      if (selectedResources.ambulance) {
        dataStore.createRequest({
          requestId: 'REQ-' + Date.now().toString().slice(-6) + '-4',
          caseId: newCaseId,
          patientUid: currentUser?.uid || 'patient-demo-01',
          patientName: patientName.trim(),
          providerUid: 'amb-demo-01',
          providerName: 'SwiftCare Emergency Ambulance Fleet',
          resourceType: 'ambulance',
          details: {
            vehicleType: 'ALS Cardiac Ambulance',
            pickupAddress: incidentAddress.trim(),
            destinationAddress: currentProvider.name || 'KIMS Super Specialty Hospital'
          },
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('DataStore sync note:', err);
    } finally {
      setIsSubmittingEmergency(false);
    }

    // Navigate to Emergency Case Confirmation Screen (Screen D)
    setCurrentScreen('case-confirmation');
  };

  const copyCaseId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedCaseId(true);
    setTimeout(() => setCopiedCaseId(false), 2500);
  };

  const resetCaseForm = () => {
    const linked = linkedPatients.find((l) => l.id === selectedLinkedPatientId) || linkedPatients[0];
    if (linked) {
      setPatientName(linked.patientName);
      setPatientAge(String(linked.patientAge || ''));
      setPatientGender(linked.patientGender || 'Male');
      setPatientBloodGroup(linked.patientBloodGroup || 'Unknown');
      setAttendantRelation(linked.relationship || 'Attendant');
    } else {
      setPatientName('');
      setPatientAge('');
      setPatientGender('Male');
      setPatientBloodGroup('Unknown');
      setAttendantRelation('Attendant');
    }
    setPatientCondition('');
    setAttendantName(currentUser?.displayName || 'Sahana S.');
    setAttendantPhone(currentUser?.phone || '');
    setEmergencyDescription('');
    setIncidentAddress(searchLocation || 'Hubballi, Karnataka');
    setFormErrors({});
  };

  const handleLinkPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!newPatientName.trim()) {
      errs.name = 'Patient full name is required';
    }
    if (!newPatientAge.trim() || isNaN(Number(newPatientAge)) || Number(newPatientAge) <= 0 || Number(newPatientAge) > 125) {
      errs.age = 'Please enter a valid age (1-125)';
    }
    if (!newPatientRelation.trim()) {
      errs.relation = 'Relationship is required';
    }
    if (!newPatientConsent) {
      errs.consent = 'Patient or legal guardian consent must be confirmed before linking and accessing patient records.';
    }
    if (Object.keys(errs).length > 0) {
      setLinkPatientErrors(errs);
      return;
    }
    setLinkPatientErrors({});
    setIsLinkingSubmitting(true);

    try {
      const pUid = newPatientUid.trim() || ('pat-' + Date.now().toString().slice(-6));
      const linkId = `${currentUser?.uid || 'att'}_${pUid}`;
      const newLink: PatientLink = {
        id: linkId,
        attendantUid: currentUser?.uid || 'patient-demo-01',
        attendantName: currentUser?.displayName || 'Sahana S.',
        attendantEmail: currentUser?.email || 'sahana2006@gmail.com',
        patientUid: pUid,
        patientName: newPatientName.trim(),
        relationship: newPatientRelation.trim(),
        patientAge: Number(newPatientAge.trim()),
        patientGender: newPatientGender,
        patientBloodGroup: newPatientBloodGroup,
        emergencyContactPhone: newPatientPhone.trim() || currentUser?.phone || '',
        medicalNotes: newPatientNotes.trim(),
        consentGranted: true,
        consentStatus: 'granted',
        consentDate: new Date().toISOString(),
        consentType: newPatientRelation === 'Guardian' || newPatientRelation === 'Parent' ? 'legal_guardian_consent' : 'explicit_patient_consent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await savePatientLinkToFirestore(newLink);
      setLinkedPatients((prev) => [newLink, ...prev.filter((l) => l.id !== linkId)]);
      setSelectedLinkedPatientId(newLink.id);
      setLinkingSuccessMsg(`Patient ${newLink.patientName} successfully linked to your attendant account.`);

      // Reset fields
      setNewPatientName('');
      setNewPatientAge('');
      setNewPatientPhone('');
      setNewPatientNotes('');
      setNewPatientUid('');
      setTimeout(() => {
        setIsLinkPatientModalOpen(false);
        setLinkingSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setLinkPatientErrors({ general: err.message || 'Failed to link patient' });
    } finally {
      setIsLinkingSubmitting(false);
    }
  };

  const handleRemovePatientLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to unlink this patient record?')) return;
    await deletePatientLinkFromFirestore(linkId);
    setLinkedPatients((prev) => prev.filter((l) => l.id !== linkId));
    if (selectedLinkedPatientId === linkId) {
      setSelectedLinkedPatientId('');
    }
  };

  const handleReturnToDashboard = () => {
    setCurrentScreen('dashboard');
  };

  const handleCreateNewCase = () => {
    resetCaseForm();
    setCurrentScreen('selection');
  };

  const handleMarkCaseCompleted = (caseId: string) => {
    setCasesList((prev) => {
      const updated = prev.map((c) => (c.caseId === caseId ? { ...c, status: 'Completed' as const } : c));
      try {
        localStorage.setItem('carebridge_cases_list', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    if (selectedDashboardCase?.caseId === caseId) {
      setSelectedDashboardCase((prev) => (prev ? { ...prev, status: 'Completed' } : null));
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#F0F4F8] text-slate-900 font-sans flex flex-col justify-between selection:bg-teal-100 selection:text-teal-900">
      {/* Global CareBridge Official Header & Notification Telemetry */}
      <Header
        onNavigateLanding={() => setCurrentScreen('landing')}
        onOpenLogin={() => setCurrentScreen('login')}
        onOpenSignup={() => setCurrentScreen('signup')}
      />

      {/* Administrative Inspection Bar (Visible Only When Authenticated As Coordinator/Admin) */}
      {currentUser?.role === 'admin' && (
        <div className="bg-[#0b2849] text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-blue-950 z-30 font-sans">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-purple-600 px-2 py-0.5 rounded text-white font-mono">
              Central Coordinator Oversight
            </span>
          </div>

          <div className="flex items-center gap-2 font-medium text-xs">
            <button
              onClick={() => setCurrentScreen('landing')}
              className={`px-2 py-0.5 rounded transition-colors ${
                currentScreen === 'landing' ? 'bg-teal-400 text-slate-900 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Public Portal
            </button>
            <span className="text-slate-400">/</span>
            <button
              onClick={() => setCurrentScreen('dashboard')}
              className={`px-2 py-0.5 rounded transition-colors ${
                currentScreen === 'dashboard' ? 'bg-teal-400 text-slate-900 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Admin Dashboard
            </button>
          </div>
        </div>
      )}

      {/* PUBLIC LANDING PAGE (First-Time Visitor Experience) */}
      {currentScreen === 'landing' && (
        <LandingPage
          onStartEmergency={() => {
            if (!currentUser) {
              setCurrentScreen('login');
            } else {
              setCurrentScreen('selection');
            }
          }}
          onOpenLogin={() => setCurrentScreen('login')}
          onOpenSignup={() => setCurrentScreen('signup')}
        />
      )}

      {/* AUTHENTICATION VIEW (Dedicated Login / Sign Up / Forgot Password) */}
      {(currentScreen === 'login' || currentScreen === 'signup' || currentScreen === 'forgot') && (
        <AuthPage
          initialMode={currentScreen}
          onNavigateHome={() => setCurrentScreen('landing')}
          onSuccessRedirect={() => setCurrentScreen('dashboard')}
        />
      )}


      {/* ============================================================== */}
      {/* SCREEN B: EMERGENCY RESOURCE SELECTION (Matches Screenshot 2)   */}
      {/* ============================================================== */}
      {currentScreen === 'selection' && (
        <div className="flex-1 flex flex-col relative overflow-y-auto">
          {/* Top Bar with CareBridge Logo & Title */}
          <div className="bg-[#EEF3F8] px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-200 z-10">
            <div className="flex items-center gap-3">
              <CareBridgeLogoIcon className="h-9 w-9" />
              <span className="text-2xl font-bold tracking-tight text-[#0F3868]">CareBridge</span>
              <span className="text-slate-400 text-xl font-light">|</span>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F3868] tracking-tight">
                Emergency Resource Selection
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentScreen('login')}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Login</span>
              </button>
            </div>
          </div>

          {/* Main Body with Blue Band Accent */}
          <div className="flex-1 relative p-4 sm:p-6 lg:p-10 flex flex-col justify-between">
            {/* Background Blue Band across Middle */}
            <div className="absolute inset-x-0 top-16 bottom-16 bg-[#0F4C81] z-0 pointer-events-none"></div>

            {/* Foreground Two Panels Grid: strictly side-by-side on desktop and laptop screens (md:grid-cols-2) */}
            <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch my-auto">
              
              {/* PANEL 1: "1. Select Resources" (Left White Card) */}
              <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-7 border border-slate-100 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-5 tracking-tight">
                    1. Select Resources
                  </h2>

                  {/* Resource Cards Layout: Row 1 (3 items), Row 2 (2 items centered) */}
                  <div className="space-y-3.5">
                    {/* Top Row: 3 items with equal width */}
                    <div className="grid grid-cols-3 gap-3.5">
                      {/* Hospital Beds */}
                      <div
                        onClick={() => toggleResource('beds')}
                        className={`relative cursor-pointer rounded-2xl p-3 flex flex-col items-center justify-between text-center transition-all h-32 sm:h-34 border-2 ${
                          selectedResources.beds
                            ? 'bg-[#00707E] text-white border-[#00707E] shadow-md'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        {selectedResources.beds && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white text-[#00707E] flex items-center justify-center shadow-xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                        <HospitalBedIcon isSelected={selectedResources.beds} />
                        <span className="text-xs font-bold leading-tight mt-1">Hospital Beds</span>
                      </div>

                      {/* ICU Facilities */}
                      <div
                        onClick={() => toggleResource('icu')}
                        className={`relative cursor-pointer rounded-2xl p-3 flex flex-col items-center justify-between text-center transition-all h-32 sm:h-34 border-2 ${
                          selectedResources.icu
                            ? 'bg-white text-slate-900 border-[#00707E] shadow-md'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        {selectedResources.icu && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#00707E] text-white flex items-center justify-center shadow-xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                        <IcuFacilityIcon isSelected={false} />
                        <span className="text-xs font-bold leading-tight mt-1">ICU Facilities</span>
                      </div>

                      {/* Blood */}
                      <div
                        onClick={() => toggleResource('blood')}
                        className={`relative cursor-pointer rounded-2xl p-3 flex flex-col items-center justify-between text-center transition-all h-32 sm:h-34 border-2 ${
                          selectedResources.blood
                            ? 'bg-white text-slate-900 border-[#00707E] shadow-md'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        {selectedResources.blood && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#00707E] text-white flex items-center justify-center shadow-xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                        <BloodDropIcon isSelected={false} />
                        <span className="text-xs font-bold leading-tight mt-1">Blood</span>
                      </div>
                    </div>

                    {/* Bottom Row: 2 items centered with IDENTICAL width and height to row 1 */}
                    <div className="flex justify-center gap-3.5">
                      {/* Oxygen */}
                      <div
                        onClick={() => toggleResource('oxygen')}
                        className={`relative cursor-pointer rounded-2xl p-3 flex flex-col items-center justify-between text-center transition-all h-32 sm:h-34 w-[calc((100%-1.75rem)/3)] border-2 ${
                          selectedResources.oxygen
                            ? 'bg-white text-slate-900 border-[#00707E] shadow-md'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        {selectedResources.oxygen && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#00707E] text-white flex items-center justify-center shadow-xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                        <OxygenTankIcon isSelected={false} />
                        <span className="text-xs font-bold leading-tight mt-1">Oxygen</span>
                      </div>

                      {/* Ambulance Services */}
                      <div
                        onClick={() => toggleResource('ambulance')}
                        className={`relative cursor-pointer rounded-2xl p-3 flex flex-col items-center justify-between text-center transition-all h-32 sm:h-34 w-[calc((100%-1.75rem)/3)] border-2 ${
                          selectedResources.ambulance
                            ? 'bg-[#00707E] text-white border-[#00707E] shadow-md'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        {selectedResources.ambulance && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white text-[#00707E] flex items-center justify-center shadow-xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                        <AmbulanceVehicleIcon isSelected={selectedResources.ambulance} />
                        <span className="text-xs font-bold leading-tight mt-1">Ambulance Services</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                  Tip: Tap cards to toggle required resources for this emergency case.
                </div>
              </div>

              {/* PANEL 2: "2. Enter Location & Provider Status" (Right Soft-Blue Card) */}
              <div className="bg-[#EEF3F8] rounded-3xl shadow-xl p-6 sm:p-7 border border-slate-200/60 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0F3868] mb-4 tracking-tight">
                    2. Enter Location & Provider Status
                  </h2>

                  {/* Location Search Bar */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        value={searchLocation}
                        onChange={(e) => handleUpdateLocation(e.target.value)}
                        placeholder="Hubballi, Karnataka, India"
                        className="w-full pl-10 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900 shadow-2xs"
                      />
                    </div>
                    <button
                      onClick={() => {}}
                      className="px-6 py-2 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white text-sm font-semibold transition-colors shadow-xs shrink-0"
                    >
                      Search
                    </button>
                  </div>

                  {/* Provider Results List (Clean white card matching Screenshot 2) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden mb-5">
                    {/* Provider 1: St. Luke's Medical Center */}
                    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          St. Luke's Medical Center
                        </h3>
                        <p className="text-xs text-slate-800 mt-0.5">
                          Available Resources:{' '}
                          <span className="font-semibold text-slate-900">5 Hospital Beds, 2 ICU.</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Latest Update: 2 mins ago.
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Overall Rating: 4.8 Stars.{' '}
                          <span className="text-[#00707E] font-medium cursor-pointer hover:underline">[View Reviews]</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleSelectProvider('prov-01')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs shrink-0 ${
                          selectedProviderId === 'prov-01'
                            ? 'bg-[#005863] text-white ring-2 ring-teal-400'
                            : 'bg-[#00707E] hover:bg-[#005B66] text-white'
                        }`}
                      >
                        {selectedProviderId === 'prov-01' ? 'Selected ✓' : 'Select Provider'}
                      </button>
                    </div>

                    {/* Provider 2: City General Hospital */}
                    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          City General Hospital
                        </h3>
                        <p className="text-xs text-slate-800 mt-0.5">
                          Available Resources:{' '}
                          <span className="font-semibold text-slate-900">
                            2 Hospital Beds, 1 ICU, 15 Units B+ Blood, 10 Oxygen Tanks.
                          </span>
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Latest Update: 10 mins ago.
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Overall Rating: 4.5 Stars.{' '}
                          <span className="text-[#00707E] font-medium cursor-pointer hover:underline">[View Reviews]</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleSelectProvider('prov-02')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs shrink-0 ${
                          selectedProviderId === 'prov-02'
                            ? 'bg-[#005863] text-white ring-2 ring-teal-400'
                            : 'bg-[#00707E] hover:bg-[#005B66] text-white'
                        }`}
                      >
                        {selectedProviderId === 'prov-02' ? 'Selected ✓' : 'Select Provider'}
                      </button>
                    </div>

                    {/* Provider 3: Paramount Ambulance Service */}
                    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          Paramount Ambulance Service
                        </h3>
                        <p className="text-xs text-slate-800 mt-0.5">
                          Available Resources:{' '}
                          <span className="font-semibold text-slate-900">3 Ambulances.</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Latest Update: 5 mins ago.
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Overall Rating: 4.9 Stars.{' '}
                          <span className="text-[#00707E] font-medium cursor-pointer hover:underline">[View Reviews]</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleSelectProvider('prov-03')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs shrink-0 ${
                          selectedProviderId === 'prov-03'
                            ? 'bg-[#005863] text-white ring-2 ring-teal-400'
                            : 'bg-[#00707E] hover:bg-[#005B66] text-white'
                        }`}
                      >
                        {selectedProviderId === 'prov-03' ? 'Selected ✓' : 'Select Provider'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Confirm & Proceed Button (Matches Screenshot 2: wide full-width teal button at bottom of panel) */}
                <button
                  onClick={() => setCurrentScreen('case-details')}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-sm sm:text-base shadow-md transition-all active:scale-[0.99] text-center"
                >
                  Confirm & Proceed with Selection
                </button>
              </div>

            </div>

            {/* Mandatory Availability Disclaimer (Exact match to screenshot bottom note) */}
            <div className="relative z-10 text-center py-3 text-xs sm:text-sm text-slate-700 font-medium">
              *All availability data is real-time and reported by registered providers.*
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN C: EMERGENCY CASE DETAILS (Task 1.5)                     */}
      {/* ============================================================== */}
      {currentScreen === 'case-details' && (
        <div className="flex-1 flex flex-col relative overflow-y-auto">
          {/* Top Bar with CareBridge Logo & Title */}
          <div className="bg-[#EEF3F8] px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-200 z-10">
            <div className="flex items-center gap-3">
              <CareBridgeLogoIcon className="h-9 w-9" />
              <span className="text-2xl font-bold tracking-tight text-[#0F3868]">CareBridge</span>
              <span className="text-slate-400 text-xl font-light">|</span>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F3868] tracking-tight">
                Emergency Case Details
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentScreen('selection')}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Resource Selection</span>
              </button>
            </div>
          </div>

          {/* Main Body with Blue Band Accent */}
          <div className="flex-1 relative p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
            {/* Background Blue Band across Middle */}
            <div className="absolute inset-x-0 top-16 bottom-16 bg-[#0F4C81] z-0 pointer-events-none"></div>

            {/* Main Two-Column Layout */}
            <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start my-auto">
              
              {/* LEFT COLUMN: Case Intake & Clinical Triage Form (7 Columns) */}
              <div className="lg:col-span-7 bg-white rounded-3xl shadow-xl p-6 sm:p-7 border border-slate-100">
                
                {/* Form Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#00707E] flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                        Emergency Patient Intake & Triage
                      </h2>
                      <p className="text-xs text-slate-500">
                        Please provide accurate clinical and contact details for emergency dispatch.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono px-2.5 py-1 rounded bg-teal-50 text-[#00707E] border border-teal-200 shrink-0 hidden sm:inline-block">
                    Step 3 of 3
                  </span>
                </div>

                <form onSubmit={handleSubmitCase} className="space-y-5">
                  
                  {/* SECTION 1: PATIENT INFORMATION */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[#00707E]" />
                      <span>1. Patient Information</span>
                    </h3>

                    <div className="space-y-3">
                      {/* Linked Patient Quick-Select Dropdown */}
                      {linkedPatients.length > 0 && (
                        <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3">
                          <label className="block text-xs font-bold text-teal-900 mb-1 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-[#00707E]" />
                            <span>Select from Authorized Linked Patients:</span>
                          </label>
                          <select
                            onChange={(e) => {
                              const selected = linkedPatients.find((p) => p.id === e.target.value);
                              if (selected) {
                                setPatientName(selected.patientName);
                                setPatientAge(String(selected.patientAge));
                                setPatientGender(selected.patientGender);
                                setPatientBloodGroup(selected.patientBloodGroup || 'Unknown');
                                setAttendantRelation(selected.relationship || 'Guardian');
                                if (selected.emergencyContactPhone) setAttendantPhone(selected.emergencyContactPhone);
                                if (selected.medicalNotes) setPatientCondition(selected.medicalNotes);
                                if (formErrors.patientName) setFormErrors((prev) => ({ ...prev, patientName: '' }));
                                if (formErrors.patientAge) setFormErrors((prev) => ({ ...prev, patientAge: '' }));
                              }
                            }}
                            defaultValue=""
                            className="w-full px-3 py-1.5 text-xs bg-white border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-800"
                          >
                            <option value="" disabled>-- Select a linked patient to auto-fill --</option>
                            {linkedPatients.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.patientName} ({p.relationship} • {p.patientAge}y • {p.patientBloodGroup})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Patient Full Name */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Patient Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={patientName}
                          onChange={(e) => {
                            setPatientName(e.target.value);
                            if (formErrors.patientName) setFormErrors((prev) => ({ ...prev, patientName: '' }));
                          }}
                          placeholder="e.g. Patient Full Name"
                          className={`w-full px-3.5 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900 ${
                            formErrors.patientName ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.patientName && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {formErrors.patientName}
                          </p>
                        )}
                      </div>

                      {/* Age, Gender & Blood Group Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Age */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Age (Years) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="125"
                            value={patientAge}
                            onChange={(e) => {
                              setPatientAge(e.target.value);
                              if (formErrors.patientAge) setFormErrors((prev) => ({ ...prev, patientAge: '' }));
                            }}
                            placeholder="e.g. 42"
                            className={`w-full px-3.5 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900 ${
                              formErrors.patientAge ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
                            }`}
                          />
                          {formErrors.patientAge && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> {formErrors.patientAge}
                            </p>
                          )}
                        </div>

                        {/* Gender */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Gender <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={patientGender}
                            onChange={(e) => setPatientGender(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        {/* Blood Group */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Blood Group
                          </label>
                          <select
                            value={patientBloodGroup}
                            onChange={(e) => setPatientBloodGroup(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                          >
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>
                      </div>

                      {/* Primary Complaint / Condition */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Primary Medical Condition / Chief Complaint <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={patientCondition}
                          onChange={(e) => {
                            setPatientCondition(e.target.value);
                            if (formErrors.patientCondition) setFormErrors((prev) => ({ ...prev, patientCondition: '' }));
                          }}
                          placeholder="e.g. Acute chest pain, shortness of breath, traumatic injury"
                          className={`w-full px-3.5 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900 ${
                            formErrors.patientCondition ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.patientCondition && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {formErrors.patientCondition}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: ATTENDANT / CONTACT INFORMATION */}
                  <div className="pt-3 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-[#00707E]" />
                      <span>2. Attendant & Contact Details</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Attendant Name */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Attendant Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={attendantName}
                          onChange={(e) => {
                            setAttendantName(e.target.value);
                            if (formErrors.attendantName) setFormErrors((prev) => ({ ...prev, attendantName: '' }));
                          }}
                          placeholder="e.g. Attendant Full Name"
                          className={`w-full px-3.5 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900 ${
                            formErrors.attendantName ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.attendantName && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {formErrors.attendantName}
                          </p>
                        )}
                      </div>

                      {/* Relationship */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Relationship
                        </label>
                        <select
                          value={attendantRelation}
                          onChange={(e) => setAttendantRelation(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                        >
                          <option value="Parent">Parent</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Child">Child</option>
                          <option value="Friend">Friend</option>
                          <option value="Guardian">Guardian</option>
                          <option value="Self">Self (Patient)</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Contact Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={attendantPhone}
                          onChange={(e) => {
                            setAttendantPhone(e.target.value);
                            if (formErrors.attendantPhone) setFormErrors((prev) => ({ ...prev, attendantPhone: '' }));
                          }}
                          placeholder="+91 98451 98765"
                          className={`w-full px-3.5 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900 ${
                            formErrors.attendantPhone ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.attendantPhone && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {formErrors.attendantPhone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: INCIDENT LOCATION */}
                  <div className="pt-3 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#00707E]" />
                      <span>3. Incident Location & Landmark</span> <span className="text-red-500">*</span>
                    </h3>

                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-2.5 h-4 w-4 text-red-500" />
                      <input
                        type="text"
                        value={incidentAddress}
                        onChange={(e) => {
                          setIncidentAddress(e.target.value);
                          if (formErrors.incidentAddress) setFormErrors((prev) => ({ ...prev, incidentAddress: '' }));
                        }}
                        placeholder="Street address, building name, landmark, Hubballi"
                        className={`w-full pl-10 pr-3.5 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900 ${
                          formErrors.incidentAddress ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
                        }`}
                      />
                    </div>
                    {formErrors.incidentAddress && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {formErrors.incidentAddress}
                      </p>
                    )}
                  </div>

                  {/* SECTION 4: EMERGENCY CATEGORY & PRIORITY */}
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Emergency Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={emergencyCategory}
                          onChange={(e) => setEmergencyCategory(e.target.value as EmergencyCategory)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                        >
                          <option value="Cardiac Emergency">Cardiac Emergency</option>
                          <option value="Trauma / Accident">Trauma / Accident</option>
                          <option value="Respiratory Distress">Respiratory Distress</option>
                          <option value="Stroke / Neurological">Stroke / Neurological</option>
                          <option value="Severe Bleeding / Hemorrhage">Severe Bleeding / Hemorrhage</option>
                          <option value="Maternal / Obstetric">Maternal / Obstetric</option>
                          <option value="Pediatric Emergency">Pediatric Emergency</option>
                          <option value="General Acute Medical">General Acute Medical</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Emergency Priority Level <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={emergencyPriority}
                          onChange={(e) => {
                            const p = e.target.value as 'Critical' | 'High' | 'Medium' | 'Low';
                            setEmergencyPriority(p);
                            if (p === 'Critical') setTriagePriority('immediate');
                            else if (p === 'High') setTriagePriority('emergency');
                            else if (p === 'Medium') setTriagePriority('urgent');
                            else setTriagePriority('semi-urgent');
                          }}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                        >
                          <option value="Critical">Critical (Immediate response required)</option>
                          <option value="High">High (Urgent intervention within 15 mins)</option>
                          <option value="Medium">Medium (Stabilization within 30 mins)</option>
                          <option value="Low">Low (Routine emergent coordination)</option>
                        </select>
                      </div>
                    </div>

                    {/* Dynamic Resource Quota Fields (when selected) */}
                    {(selectedResources.blood || selectedResources.oxygen || selectedResources.ambulance) && (
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Resource Requirements Specification
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {selectedResources.blood && (
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Blood Units ({patientBloodGroup})
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={bloodUnitsRequired}
                                onChange={(e) => setBloodUnitsRequired(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                              />
                            </div>
                          )}

                          {selectedResources.oxygen && (
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Oxygen Cylinders
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={oxygenQuantityRequired}
                                onChange={(e) => setOxygenQuantityRequired(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                              />
                            </div>
                          )}

                          {selectedResources.ambulance && (
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Ambulance Fleet Type
                              </label>
                              <select
                                value={ambulanceTypeRequired}
                                onChange={(e) => setAmbulanceTypeRequired(e.target.value as any)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                              >
                                <option value="ALS">ALS (Advanced Cardiac)</option>
                                <option value="BLS">BLS (Basic Life Support)</option>
                                <option value="Patient Transport">Patient Transport</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 5: CLINICAL TRIAGE PRIORITY ASSESSMENT */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-[#00707E]" />
                        <span>5. Clinical Triage Urgency</span> <span className="text-red-500">*</span>
                      </h3>
                      <span className="text-[11px] text-slate-400">Select urgency level</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* Level 1: Immediate */}
                      <div
                        onClick={() => {
                          setTriagePriority('immediate');
                          setEmergencyPriority('Critical');
                        }}
                        className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col justify-between text-left ${
                          triagePriority === 'immediate'
                            ? 'border-red-600 bg-red-50 ring-2 ring-red-400/30'
                            : 'border-slate-200 bg-white hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-600 text-white">
                            Level 1
                          </span>
                          {triagePriority === 'immediate' && (
                            <Check className="h-3.5 w-3.5 text-red-600 stroke-[3]" />
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="font-bold text-xs text-red-950">Immediate</div>
                          <div className="text-[10px] text-red-700 leading-tight">Critical / Resuscitation</div>
                        </div>
                      </div>

                      {/* Level 2: Emergency */}
                      <div
                        onClick={() => {
                          setTriagePriority('emergency');
                          setEmergencyPriority('High');
                        }}
                        className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col justify-between text-left ${
                          triagePriority === 'emergency'
                            ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/30'
                            : 'border-slate-200 bg-white hover:border-amber-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-600 text-white">
                            Level 2
                          </span>
                          {triagePriority === 'emergency' && (
                            <Check className="h-3.5 w-3.5 text-amber-600 stroke-[3]" />
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="font-bold text-xs text-amber-950">Emergency</div>
                          <div className="text-[10px] text-amber-700 leading-tight">Severe distress / Rapid</div>
                        </div>
                      </div>

                      {/* Level 3: Urgent */}
                      <div
                        onClick={() => {
                          setTriagePriority('urgent');
                          setEmergencyPriority('Medium');
                        }}
                        className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col justify-between text-left ${
                          triagePriority === 'urgent'
                            ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-400/30'
                            : 'border-slate-200 bg-white hover:border-yellow-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-600 text-white">
                            Level 3
                          </span>
                          {triagePriority === 'urgent' && (
                            <Check className="h-3.5 w-3.5 text-yellow-600 stroke-[3]" />
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="font-bold text-xs text-yellow-950">Urgent</div>
                          <div className="text-[10px] text-yellow-700 leading-tight">Serious but stable</div>
                        </div>
                      </div>

                      {/* Level 4: Semi-Urgent */}
                      <div
                        onClick={() => {
                          setTriagePriority('semi-urgent');
                          setEmergencyPriority('Low');
                        }}
                        className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col justify-between text-left ${
                          triagePriority === 'semi-urgent'
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400/30'
                            : 'border-slate-200 bg-white hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                            Level 4
                          </span>
                          {triagePriority === 'semi-urgent' && (
                            <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" />
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="font-bold text-xs text-emerald-950">Semi-Urgent</div>
                          <div className="text-[10px] text-emerald-700 leading-tight">Routine emergency</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 6: CLINICAL NOTES / EMERGENCY DESCRIPTION */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Emergency Clinical Description & Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={emergencyDescription}
                      onChange={(e) => {
                        setEmergencyDescription(e.target.value);
                        if (formErrors.emergencyDescription) setFormErrors((prev) => ({ ...prev, emergencyDescription: '' }));
                      }}
                      placeholder="Describe current symptoms, vitals, on-scene observation, and required care..."
                      className={`w-full px-3.5 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900 ${
                        formErrors.emergencyDescription ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.emergencyDescription && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {formErrors.emergencyDescription}
                      </p>
                    )}
                    {formErrors.consent && (
                      <p className="text-xs text-red-600 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>{formErrors.consent}</span>
                      </p>
                    )}
                  </div>

                </form>
              </div>

              {/* RIGHT COLUMN: Selected Resources Summary & Dispatch Action (5 Columns) */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* CARD A: Confirmed Resources from Screen B */}
                <div className="bg-[#EEF3F8] rounded-3xl shadow-xl p-5 sm:p-6 border border-slate-200/60">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm text-[#0F3868] uppercase tracking-wider">
                      Selected Healthcare Resources
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCurrentScreen('selection')}
                      className="text-xs font-semibold text-[#00707E] hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  {/* Target Provider Box */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs mb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wide bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          Assigned Target Provider
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">
                          {PROVIDERS[selectedProviderId]?.name || "St. Luke's Medical Center"}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {PROVIDERS[selectedProviderId]?.details || "5 Hospital Beds, 2 ICU"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Rating: {PROVIDERS[selectedProviderId]?.rating || "4.8 Stars"}
                        </p>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-200 text-[#00707E] flex items-center justify-center shrink-0">
                        <Heart className="h-4 w-4 fill-teal-600 text-teal-600" />
                      </div>
                    </div>
                  </div>

                  {/* Requested Resource Badges */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700 block">
                      Requested Resources for this Case:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedResources.beds && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-slate-800 text-xs font-semibold shadow-2xs">
                          <span className="h-2 w-2 rounded-full bg-[#00707E]"></span>
                          Hospital Beds
                        </span>
                      )}
                      {selectedResources.icu && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-slate-800 text-xs font-semibold shadow-2xs">
                          <span className="h-2 w-2 rounded-full bg-[#00707E]"></span>
                          ICU Facilities
                        </span>
                      )}
                      {selectedResources.blood && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-slate-800 text-xs font-semibold shadow-2xs">
                          <span className="h-2 w-2 rounded-full bg-[#00707E]"></span>
                          Blood Units
                        </span>
                      )}
                      {selectedResources.oxygen && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-slate-800 text-xs font-semibold shadow-2xs">
                          <span className="h-2 w-2 rounded-full bg-[#00707E]"></span>
                          Oxygen Supply
                        </span>
                      )}
                      {selectedResources.ambulance && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-slate-800 text-xs font-semibold shadow-2xs">
                          <span className="h-2 w-2 rounded-full bg-[#00707E]"></span>
                          Ambulance Service
                        </span>
                      )}
                    </div>
                    {formErrors.resources && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {formErrors.resources}
                      </p>
                    )}
                  </div>
                </div>

                {/* CARD B: Dispatch Action & Case Submission */}
                <div className="bg-white rounded-3xl shadow-xl p-5 sm:p-6 border border-slate-100 space-y-4">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Emergency Case Dispatch
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      A unique Case ID will be generated. Submitting alerts the emergency coordination team and reserves initial intake capacity.
                    </p>
                  </div>

                  {/* General Form Error Alert */}
                  {Object.keys(formErrors).length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 font-medium leading-relaxed">
                        Please fill in all required fields marked with * before submitting this emergency case.
                      </p>
                    </div>
                  )}

                  {/* Primary Submit Button */}
                  <button
                    type="button"
                    onClick={() => handleSubmitCase()}
                    className="w-full py-3.5 px-6 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-sm sm:text-base shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    <span>Submit Emergency Case</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {/* Secondary Back Button */}
                  <button
                    type="button"
                    onClick={() => setCurrentScreen('selection')}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Resource Selection</span>
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setCurrentScreen('login')}
                      className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                    >
                      Return to Login Screen
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Mandatory Availability Disclaimer */}
            <div className="relative z-10 text-center py-3 text-xs sm:text-sm text-slate-700 font-medium">
              *All availability data is real-time and reported by registered providers.*
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN D: EMERGENCY CASE CONFIRMATION (Task 1.6)               */}
      {/* ============================================================== */}
      {currentScreen === 'case-confirmation' && (() => {
        // Fallback demo case if user jumps directly from top demo switcher
        const displayCase = submittedCase || {
          caseId: 'CB-2026-4829',
          createdAt: '07:10 AM',
          dateStr: 'Nov 1, 2026',
          patientName: linkedPatients[0]?.patientName || 'Emergency Patient',
          patientAge: linkedPatients[0]?.patientAge ? String(linkedPatients[0].patientAge) : '42',
          patientGender: linkedPatients[0]?.patientGender || 'Other',
          patientBloodGroup: linkedPatients[0]?.patientBloodGroup || 'Unknown',
          patientCondition: 'Emergency medical intake',
          attendantName: currentUser?.displayName || 'Sahana S.',
          attendantRelation: linkedPatients[0]?.relationship || 'Attendant',
          attendantPhone: linkedPatients[0]?.emergencyContactPhone || '+91 98451 98765',
          incidentAddress: searchLocation || 'Plot 42, Vidyanagar Main Road, Hubballi, Karnataka',
          triagePriority: 'immediate' as const,
          emergencyDescription: 'Patient experienced sudden severe substernal chest discomfort radiating to left arm with diaphoresis and shortness of breath. Immediate ICU facility and cardiac bed required.',
          providerName: PROVIDERS[selectedProviderId]?.name || "St. Luke's Medical Center",
          providerDetails: PROVIDERS[selectedProviderId]?.details || '5 Hospital Beds, 2 ICU',
          providerRating: PROVIDERS[selectedProviderId]?.rating || '4.8 Stars',
          resourcesList: ['Hospital Beds', 'ICU Facilities', 'Blood', 'Oxygen', 'Ambulance Services'],
          individualStatuses: [
            {
              resource: 'Ambulance Services',
              status: 'Dispatched • En Route',
              code: 'dispatched' as const,
              detail: 'Paramedic Vehicle AMB-04 en route • Estimated ETA: 8 minutes',
              updatedAt: '1 min ago'
            },
            {
              resource: 'Hospital Beds',
              status: 'Pending Bed Allocation',
              code: 'pending' as const,
              detail: 'Triage desk alerted • Reserving inpatient emergency ward bed',
              updatedAt: '2 mins ago'
            },
            {
              resource: 'ICU Facilities',
              status: 'Under Clinical Review',
              code: 'in-review' as const,
              detail: 'ICU intensivist reviewing clinical notes & cardiac vitals',
              updatedAt: '3 mins ago'
            },
            {
              resource: 'Blood Units',
              status: 'Cross-Match Requested',
              code: 'in-review' as const,
              detail: 'Blood bank reserve requisitioned for B+ units',
              updatedAt: 'Just now'
            },
            {
              resource: 'Oxygen Supply',
              status: 'Reserved & Staged',
              code: 'reserved' as const,
              detail: 'High-flow oxygen unit staged at reception bay',
              updatedAt: 'Just now'
            }
          ]
        };

        return (
          <div className="flex-1 flex flex-col relative overflow-y-auto">
            {/* Top Bar with CareBridge Logo & Title */}
            <div className="bg-[#EEF3F8] px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-200 z-10">
              <div className="flex items-center gap-3">
                <CareBridgeLogoIcon className="h-9 w-9" />
                <span className="text-2xl font-bold tracking-tight text-[#0F3868]">CareBridge</span>
                <span className="text-slate-400 text-xl font-light">|</span>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0F3868] tracking-tight">
                  Emergency Case Confirmation
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReturnToDashboard}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition-colors"
                >
                  <Home className="h-3.5 w-3.5 text-[#00707E]" />
                  <span>Return to Dashboard</span>
                </button>
              </div>
            </div>

            {/* Main Body with Blue Band Accent */}
            <div className="flex-1 relative p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
              {/* Background Blue Band across Middle */}
              <div className="absolute inset-x-0 top-16 bottom-16 bg-[#0F4C81] z-0 pointer-events-none"></div>

              {/* Foreground Two Panels Grid: strictly side-by-side on desktop (md:grid-cols-2) */}
              <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch my-auto">
                
                {/* PANEL 1: Case Overview & Patient Dossier (Left White Card) */}
                <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-7 border border-slate-100 flex flex-col justify-between">
                  <div>
                    {/* Header with Verified Badge */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                          <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                              Emergency Case Confirmed
                            </h2>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide">
                              Live
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Broadcast to assigned emergency healthcare response team.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Unique Case ID Box */}
                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl mb-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                          Unique CareBridge Case ID
                        </span>
                        <span className="font-mono text-xl sm:text-2xl font-bold text-[#0F3868]">
                          {displayCase.caseId}
                        </span>
                        <div className="text-[11px] text-teal-700 font-medium mt-0.5 flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>Submitted: {displayCase.dateStr} at {displayCase.createdAt}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => copyCaseId(displayCase.caseId)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white border border-teal-300 text-[#00707E] hover:bg-teal-100 transition-colors shadow-2xs shrink-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copiedCaseId ? 'Copied!' : 'Copy ID'}</span>
                      </button>
                    </div>

                    {/* Patient & Incident Dossier */}
                    <div className="space-y-2.5 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-700">
                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500 font-medium">Patient Details:</span>
                        <span className="font-bold text-slate-900">
                          {displayCase.patientName} ({displayCase.patientAge}y, {displayCase.patientGender}) • Blood {displayCase.patientBloodGroup}
                        </span>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500 font-medium">Triage Urgency:</span>
                        <span className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded ${
                          displayCase.triagePriority === 'immediate'
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : displayCase.triagePriority === 'emergency'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : displayCase.triagePriority === 'urgent'
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          <Activity className="h-3 w-3" />
                          Level {displayCase.triagePriority === 'immediate' ? '1 - Immediate' : displayCase.triagePriority === 'emergency' ? '2 - Emergency' : displayCase.triagePriority === 'urgent' ? '3 - Urgent' : '4 - Semi-Urgent'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500 font-medium">Chief Complaint:</span>
                        <span className="font-bold text-slate-900 text-right">{displayCase.patientCondition}</span>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500 font-medium">Attendant & Phone:</span>
                        <span className="font-semibold text-slate-800">
                          {displayCase.attendantName} ({displayCase.attendantRelation}) • {displayCase.attendantPhone}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                          <span>Incident Location:</span>
                        </span>
                        <span className="font-semibold text-slate-800 text-right">{displayCase.incidentAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Simulated Data Indicator */}
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="font-bold text-[#00707E]">[Simulated Frontend Data]</span>
                    <span>Saved in browser session state (Phase 1 preview).</span>
                  </div>
                </div>

                {/* PANEL 2: Assigned Provider & Individual Request Statuses (Right Soft-Blue Card) */}
                <div className="bg-[#EEF3F8] rounded-3xl shadow-xl p-6 sm:p-7 border border-slate-200/60 flex flex-col justify-between">
                  <div>
                    {/* Target Provider Card */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs mb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wide bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Assigned Healthcare Provider
                          </span>
                          <h3 className="font-bold text-base text-slate-900 mt-1">
                            {displayCase.providerName}
                          </h3>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {displayCase.providerDetails} • {displayCase.providerRating}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Hotline: {PROVIDERS[selectedProviderId]?.phone || '+91 836 225 1100'} • {PROVIDERS[selectedProviderId]?.address || 'Hubballi'}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#00707E] flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    {/* Individual Request Statuses */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F3868]">
                          Individual Resource Request Statuses
                        </h4>
                        <span className="text-[11px] text-slate-500 font-medium">Real-time status updates</span>
                      </div>

                      <div className="space-y-2.5">
                        {displayCase.individualStatuses.map((req, idx) => (
                          <div
                            key={idx}
                            className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">{req.resource}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  req.code === 'dispatched'
                                    ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                    : req.code === 'reserved'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : req.code === 'pending'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                                }`}>
                                  {req.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">{req.detail}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 self-end sm:self-auto">
                              {req.updatedAt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Functional Action Buttons */}
                  <div className="space-y-2.5 pt-2">
                    {/* View Emergency Case */}
                    <button
                      type="button"
                      onClick={() => setIsViewCaseModalOpen(true)}
                      className="w-full py-3.5 px-6 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-sm sm:text-base shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View Emergency Case</span>
                    </button>

                    {/* Return to Dashboard */}
                    <button
                      type="button"
                      onClick={handleReturnToDashboard}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-2xs"
                    >
                      <Home className="h-4 w-4 text-[#00707E]" />
                      <span>Return to Dashboard</span>
                    </button>

                    {/* Create New Case Link */}
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleCreateNewCase}
                        className="text-xs text-slate-500 hover:text-slate-800 hover:underline flex items-center justify-center gap-1 mx-auto"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Create New Emergency Case</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Mandatory Availability Disclaimer */}
              <div className="relative z-10 text-center py-3 text-xs sm:text-sm text-slate-700 font-medium">
                *All availability data is real-time and reported by registered providers.*
              </div>
            </div>

            {/* ============================================================== */}
            {/* VIEW EMERGENCY CASE MODAL (Task 1.6 Detailed Inspection)        */}
            {/* ============================================================== */}
            {isViewCaseModalOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-7 border border-slate-100 max-h-[90vh] overflow-y-auto">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#00707E] flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                          Comprehensive Emergency Case Record
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">Case ID: {displayCase.caseId}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsViewCaseModalOpen(false)}
                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Digital Dispatch Badge */}
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wide block">
                        Dispatch Verification Code
                      </span>
                      <span className="font-mono text-base font-bold text-[#0F3868]">
                        DISPATCH-VERIFIED-{displayCase.caseId.slice(-4)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-teal-300 text-teal-800">
                      Active Dispatch
                    </span>
                  </div>

                  {/* Full Case Timeline */}
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Dispatch Event Timeline
                    </h4>
                    <div className="space-y-2 border-l-2 border-teal-500 pl-3 ml-2 text-xs text-slate-600">
                      <div>
                        <span className="font-bold text-slate-900">00:00</span> — Emergency case intake confirmed by attendant.
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">+01 min</span> — Broadcast alert routed to {displayCase.providerName}.
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">+02 min</span> — Resource reservation locks assigned for requested modules.
                      </div>
                      <div>
                        <span className="font-bold text-teal-700">Live</span> — Triage medical staff preparing receiving ward.
                      </div>
                    </div>
                  </div>

                  {/* Complete Clinical Overview */}
                  <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5">
                    <div>
                      <span className="text-slate-500 font-medium">Patient:</span>{' '}
                      <span className="font-bold text-slate-900">{displayCase.patientName}</span> ({displayCase.patientAge} years, {displayCase.patientGender})
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Blood Group:</span>{' '}
                      <span className="font-bold text-red-600">{displayCase.patientBloodGroup}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Condition & Complaint:</span>{' '}
                      <span className="font-semibold text-slate-900">{displayCase.patientCondition}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Clinical Notes:</span>{' '}
                      <span className="text-slate-700">{displayCase.emergencyDescription}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Attendant:</span>{' '}
                      <span className="font-semibold text-slate-900">{displayCase.attendantName}</span> ({displayCase.attendantRelation}) • {displayCase.attendantPhone}
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Incident Location:</span>{' '}
                      <span className="font-semibold text-slate-900">{displayCase.incidentAddress}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Assigned Provider:</span>{' '}
                      <span className="font-bold text-[#00707E]">{displayCase.providerName}</span>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => setIsViewCaseModalOpen(false)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-semibold text-xs sm:text-sm transition-colors shadow-xs"
                  >
                    Close Case Record
                  </button>

                </div>
              </div>
            )}

          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* SCREEN E: ROLE DASHBOARDS (Patient, Hospital, Blood, Oxygen, Ambulance, Doctor, Admin) */}
      {/* ============================================================== */}
      {currentScreen === 'dashboard' && (
        activeRole === 'hospital' ? (
          <HospitalDashboard />
        ) : activeRole === 'bloodBank' ? (
          <BloodBankDashboard />
        ) : activeRole === 'oxygenProvider' ? (
          <OxygenDashboard />
        ) : activeRole === 'ambulanceProvider' ? (
          <AmbulanceDashboard />
        ) : activeRole === 'doctor' ? (
          <DoctorDashboard />
        ) : activeRole === 'admin' ? (
          <AdminDashboard />
        ) : (() => {
        // Dynamic dashboard calculations from available casesList
        const totalCasesCount = casesList.length;
        const activeCasesCount = casesList.filter((c) => c.status !== 'Completed').length;
        const completedCasesCount = casesList.filter((c) => c.status === 'Completed').length;
        const pendingResourceCount = casesList.reduce((acc, c) => {
          const pendingInCase = c.individualStatuses?.filter(
            (s) => s.code === 'pending' || s.code === 'in-review' || s.code === 'reserved'
          ).length || 0;
          return acc + pendingInCase;
        }, 0);

        // Active case to highlight in Resource Request Summary (either first active case or submittedCase)
        const primaryActiveCase = casesList.find((c) => c.status !== 'Completed') || casesList[0] || null;

        // Triage badge helper
        const getTriageBadge = (priority: string) => {
          switch (priority) {
            case 'immediate':
              return (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                  Immediate (Priority 1)
                </span>
              );
            case 'emergency':
              return (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  Emergency (Priority 2)
                </span>
              );
            case 'urgent':
              return (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Urgent (Priority 3)
                </span>
              );
            default:
              return (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  Semi-Urgent (Priority 4)
                </span>
              );
          }
        };

        return (
          <div className="flex-1 flex flex-col bg-[#EEF3F8]">
            
            {/* Top Navigation Bar */}
            <div className="bg-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-200 shadow-2xs z-20">
              <div className="flex items-center gap-3">
                <CareBridgeLogoIcon className="h-9 w-9" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F3868]">CareBridge</span>
                    <span className="hidden sm:inline text-slate-300">|</span>
                    <span className="text-sm sm:text-base font-semibold text-slate-700 hidden sm:inline">
                      Patient Emergency Dashboard
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium sm:hidden">
                    Patient Emergency Dashboard
                  </span>
                </div>
              </div>

              {/* User Profile & Primary Action */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-slate-800">{currentUser?.displayName || 'Sahana S.'}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">Patient Attendant</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLinkPatientModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-teal-50 border border-teal-300 text-teal-900 hover:bg-teal-100 text-xs font-bold shadow-2xs transition-colors"
                >
                  <UserPlus className="h-4 w-4 text-teal-700" />
                  <span>+ Link Patient</span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateNewCase}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors active:scale-[0.98]"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>+ New Emergency Case</span>
                </button>
              </div>
            </div>

            {/* Dashboard Hero & Overview Statistics */}
            <div className="bg-gradient-to-r from-[#0F3868] via-[#0F4C81] to-[#00707E] text-white px-4 sm:px-8 py-6 sm:py-8 shadow-inner">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-300/30 text-teal-200 text-xs font-semibold mb-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-teal-300" />
                      <span>Verified Attendant Command Center • Hubballi Zone</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                      Welcome back, {currentUser?.displayName || 'Sahana S.'}
                    </h1>
                    <p className="text-xs sm:text-sm text-teal-100/90 mt-1 max-w-2xl">
                      Coordinate with authorized linked patients, dispatched ambulance units, and track hospital bed and ICU allocations in real-time.
                    </p>
                  </div>

                  {/* Emergency Hotline Banner */}
                  <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-3.5 flex items-center gap-3 self-start md:self-auto">
                    <div className="h-10 w-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs">
                      <Phone className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-teal-200">
                        24/7 CareBridge Emergency Dispatch
                      </div>
                      <div className="text-base sm:text-lg font-mono font-extrabold text-white">
                        108 / +91 800 227 3274
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Calculated Dynamic Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  
                  {/* Total Cases */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 transition-all hover:bg-white/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-teal-100">Total Cases</span>
                      <Layers className="h-4 w-4 text-teal-300" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-white">
                      {totalCasesCount}
                    </div>
                    <div className="text-[11px] text-teal-200/80 mt-1 flex items-center gap-1">
                      <span>Submitted records</span>
                    </div>
                  </div>

                  {/* Active Cases */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 transition-all hover:bg-white/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-teal-100">Active Cases</span>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-emerald-300">
                      {activeCasesCount}
                    </div>
                    <div className="text-[11px] text-teal-200/80 mt-1">
                      <span>In dispatch & clinical intake</span>
                    </div>
                  </div>

                  {/* Completed Cases */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 transition-all hover:bg-white/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-teal-100">Completed Cases</span>
                      <CheckCheck className="h-4 w-4 text-teal-300" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-white">
                      {completedCasesCount}
                    </div>
                    <div className="text-[11px] text-teal-200/80 mt-1">
                      <span>Discharged & resolved</span>
                    </div>
                  </div>

                  {/* Pending Resource Requests */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 transition-all hover:bg-white/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-teal-100">Pending Requests</span>
                      <Clock className="h-4 w-4 text-amber-300" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-amber-300">
                      {pendingResourceCount}
                    </div>
                    <div className="text-[11px] text-teal-200/80 mt-1">
                      <span>Active resource allocations</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Quick Actions & Navigation Bar */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-2.5 sticky top-0 z-10 shadow-2xs">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setDashboardTab('cases')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      dashboardTab === 'cases'
                        ? 'bg-[#00707E] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>My Emergency Cases ({totalCasesCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashboardTab('patients')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      dashboardTab === 'patients'
                        ? 'bg-[#00707E] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Linked Patients ({linkedPatients.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashboardTab('track')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      dashboardTab === 'track'
                        ? 'bg-[#00707E] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>Track Requests</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashboardTab('notifications')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      dashboardTab === 'notifications'
                        ? 'bg-[#00707E] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    <span>Notifications</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashboardTab('history')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      dashboardTab === 'history'
                        ? 'bg-[#00707E] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Emergency History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashboardTab('profile')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      dashboardTab === 'profile'
                        ? 'bg-[#00707E] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Profile Settings</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCreateNewCase}
                  className="hidden md:flex items-center gap-1 text-xs font-bold text-[#00707E] hover:text-[#005B66] hover:underline"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>+ Create Case</span>
                </button>
              </div>
            </div>

            {/* Main Dashboard Content Area */}
            <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">

              {/* TAB 1: MY EMERGENCY CASES & RESOURCE SUMMARY */}
              {dashboardTab === 'cases' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: My Emergency Cases (7 cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between pb-1">
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                          <FileText className="h-5 w-5 text-[#00707E]" />
                          <span>My Emergency Cases</span>
                        </h2>
                        <p className="text-xs text-slate-500">
                          Submitted cases from this device with active triage and provider routing
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-800">
                        {casesList.length} {casesList.length === 1 ? 'Record' : 'Records'}
                      </span>
                    </div>

                    {/* Case Cards List or Empty State */}
                    {casesList.length === 0 ? (
                      linkedPatients.length === 0 ? (
                        <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border border-slate-200 shadow-xs">
                          <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                            <Users className="h-8 w-8" />
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-3">
                            <User className="h-3.5 w-3.5 text-teal-600" />
                            <span>Patient Attendant Command</span>
                          </div>
                          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                            No Patients Linked to Your Account
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
                            Welcome, <span className="font-semibold text-slate-900">{currentUser?.displayName || 'Sahana S.'}</span>. As a Patient Attendant, please link or register the patient or family member you assist to begin emergency resource coordination.
                          </p>
                          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => setIsLinkPatientModalOpen(true)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-[0.98]"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span>+ Register / Link Patient</span>
                            </button>
                          </div>
                          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                              <div className="font-bold text-slate-900 mb-1">1. Link Patient</div>
                              <p className="text-slate-500 text-[11px]">Add dependent or family member.</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                              <div className="font-bold text-slate-900 mb-1">2. Request Care</div>
                              <p className="text-slate-500 text-[11px]">Instant bed, ICU & ambulance dispatch.</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                              <div className="font-bold text-slate-900 mb-1">3. Live Tracking</div>
                              <p className="text-slate-500 text-[11px]">Track responder updates in real time.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200 shadow-xs">
                          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                            <FileText className="h-8 w-8" />
                          </div>
                          <h3 className="text-base font-bold text-slate-800">No emergency cases found</h3>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            You have {linkedPatients.length} linked patient(s). When an emergency arises, create an emergency case to allocate hospital beds, ICU facilities, blood, oxygen, and ambulances.
                          </p>
                          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={handleCreateNewCase}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-xs shadow-sm transition-colors"
                            >
                              <PlusCircle className="h-4 w-4" />
                              <span>Create New Emergency Case</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsLinkPatientModalOpen(true)}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span>Link Another Patient</span>
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-3.5">
                        {casesList.map((c) => (
                          <div
                            key={c.caseId}
                            className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-teal-300 transition-all group"
                          >
                            {/* Card Top: Case ID, Status, Timestamp */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs sm:text-sm font-extrabold text-[#0F3868] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {c.caseId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyCaseId(c.caseId)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-50"
                                  title="Copy Case ID"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {c.dateStr} • {c.createdAt}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {c.status === 'Completed' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                                    <CheckCheck className="h-3 w-3 text-emerald-600" />
                                    Completed
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-ping" />
                                    Active Dispatch
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Card Body: Patient Name, Triage, Condition */}
                            <div className="pt-3 pb-3 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-extrabold text-slate-900 text-base">
                                    {c.patientName}
                                  </h3>
                                  <span className="text-xs text-slate-500 font-medium">
                                    ({c.patientAge}y • {c.patientGender})
                                  </span>
                                  {c.patientBloodGroup && c.patientBloodGroup !== 'Unknown' && (
                                    <span className="px-2 py-0.5 rounded font-bold text-xs bg-red-50 text-red-700 border border-red-200">
                                      {c.patientBloodGroup}
                                    </span>
                                  )}
                                </div>
                                {getTriageBadge(c.triagePriority)}
                              </div>

                              <div className="text-xs text-slate-700 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                <span className="font-bold text-slate-900">Condition: </span>
                                <span>{c.patientCondition}</span>
                              </div>

                              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="flex items-center gap-1 text-slate-600">
                                  <Building2 className="h-3.5 w-3.5 text-[#00707E]" />
                                  <span className="font-semibold">{c.providerName}</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Attendant: {c.attendantName} ({c.attendantRelation})</span>
                                </span>
                              </div>
                            </div>

                            {/* Card Footer: Resources Requested + View Details Action */}
                            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1">
                                {c.resourcesList?.map((res) => (
                                  <span
                                    key={res}
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200"
                                  >
                                    {res}
                                  </span>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedDashboardCase(c)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#00707E] hover:text-white text-slate-800 text-xs font-bold transition-all"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>View Case Details</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Resource Request Summary (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="pb-1">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#00707E]" />
                        <span>Resource Request Summary</span>
                      </h2>
                      <p className="text-xs text-slate-500">
                        Live status for all 5 emergency resource categories
                      </p>
                    </div>

                    {/* Dynamic Emergency Resource Category Status Cards */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
                      
                      {primaryActiveCase ? (
                        <>
                          {/* Active Case Header for context */}
                          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wider block">
                                Tracking Case
                              </span>
                              <span className="font-mono font-bold text-[#0F3868]">
                                {primaryActiveCase.caseId} • {primaryActiveCase.patientName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedDashboardCase(primaryActiveCase)}
                              className="text-xs font-semibold text-[#00707E] hover:underline"
                            >
                              Details →
                            </button>
                          </div>

                          {/* Dynamic resource statuses from active case */}
                          {primaryActiveCase.individualStatuses && primaryActiveCase.individualStatuses.length > 0 ? (
                            primaryActiveCase.individualStatuses.map((item) => {
                              const isBed = item.resource.toLowerCase().includes('bed');
                              const isIcu = item.resource.toLowerCase().includes('icu');
                              const isBlood = item.resource.toLowerCase().includes('blood');
                              const isOxygen = item.resource.toLowerCase().includes('oxygen');
                              const isAmb = item.resource.toLowerCase().includes('ambulance');

                              const badgeColor = isBlood
                                ? 'bg-red-100 text-red-800'
                                : isOxygen
                                ? 'bg-sky-100 text-sky-800'
                                : isAmb
                                ? 'bg-emerald-100 text-emerald-800'
                                : isIcu
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-amber-100 text-amber-800';

                              const tagAbbr = isBlood ? 'BLD' : isOxygen ? 'O2' : isAmb ? 'AMB' : isIcu ? 'ICU' : 'BED';

                              return (
                                <div
                                  key={item.resource}
                                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-white hover:border-teal-200 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`h-8 w-8 rounded-lg ${badgeColor} flex items-center justify-center font-bold text-xs`}>
                                        {tagAbbr}
                                      </div>
                                      <div>
                                        <h4 className="text-xs font-bold text-slate-900">{item.resource}</h4>
                                        <p className="text-[11px] text-slate-500">{primaryActiveCase.providerName}</p>
                                      </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                      {item.status}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 mt-2 pl-10 border-l-2 border-teal-500">
                                    {item.detail}
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                              Resources requested: {primaryActiveCase.resourcesList?.join(', ') || 'Emergency assistance'}. Awaiting provider assignment.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/60">
                          <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#00707E] flex items-center justify-center mx-auto mb-2">
                            <Activity className="h-5 w-5" />
                          </div>
                          <h4 className="text-xs font-bold text-slate-800">No Active Resource Requests</h4>
                          <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                            When an emergency case is initiated, live dispatch status for beds, ICU, blood units, oxygen supply, and ambulance fleets will update here in real time.
                          </p>
                          {linkedPatients.length > 0 ? (
                            <button
                              type="button"
                              onClick={handleCreateNewCase}
                              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00707E] hover:bg-[#005B66] text-white text-xs font-bold shadow-2xs transition-colors"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                              <span>Create Emergency Case</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsLinkPatientModalOpen(true)}
                              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00707E] hover:bg-[#005B66] text-white text-xs font-bold shadow-2xs transition-colors"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span>Link a Patient</span>
                            </button>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Quick Call Assistance Card */}
                    <div className="bg-gradient-to-br from-[#0F3868] to-[#00707E] text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-teal-200">Need Immediate Help?</h4>
                        <p className="text-xs text-white/90 mt-0.5">Direct triage support with hub coordinator</p>
                      </div>
                      <a
                        href="tel:108"
                        className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Call 108</span>
                      </a>
                    </div>

                  </div>

                </div>
              )}

              {/* TAB: LINKED PATIENTS */}
              {dashboardTab === 'patients' && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="h-5 w-5 text-[#00707E]" />
                        <span>Authorized Linked Patients</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Family members and patients authorized under your attendant profile ({currentUser?.displayName || 'Sahana S.'})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLinkPatientModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-xs shadow-sm transition-all"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>+ Register / Link Patient</span>
                    </button>
                  </div>

                  {linkedPatients.length === 0 ? (
                    <div className="text-center py-12 px-4 max-w-md mx-auto">
                      <div className="h-14 w-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto mb-3">
                        <Users className="h-7 w-7" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">No Patients Linked Yet</h3>
                      <p className="text-xs text-slate-500 mt-1 mb-5">
                        You currently have no patients associated with your account. Link a patient or family member to initiate emergency bed reservations, oxygen requests, and ambulance dispatch.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsLinkPatientModalOpen(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-xs shadow-sm transition-all"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>Link Patient Now</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {linkedPatients.map((patient) => (
                        <div
                          key={patient.id}
                          className="p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-300 transition-all shadow-xs flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-800 font-extrabold flex items-center justify-center text-sm">
                                  {patient.patientName.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-slate-900 text-base">{patient.patientName}</h3>
                                  <p className="text-xs text-slate-500 font-medium">
                                    {patient.relationship} • {patient.patientAge} years • {patient.patientGender}
                                  </p>
                                </div>
                              </div>
                              {patient.patientBloodGroup && patient.patientBloodGroup !== 'Unknown' && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                  {patient.patientBloodGroup}
                                </span>
                              )}
                            </div>

                            <div className="py-3 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-slate-600">
                                <span className="font-medium text-slate-500">Emergency Phone:</span>
                                <span className="font-semibold text-slate-900">{patient.emergencyContactPhone || 'Not specified'}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600">
                                <span className="font-medium text-slate-500">Patient Consent:</span>
                                <span className="inline-flex items-center gap-1 font-bold text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                  <span>Verified & Active</span>
                                </span>
                              </div>
                              {patient.medicalNotes && (
                                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-slate-700">
                                  <span className="font-bold text-slate-900 block mb-0.5">Known Medical Notes / Allergies:</span>
                                  <span>{patient.medicalNotes}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPatientName(patient.patientName);
                                setPatientAge(String(patient.patientAge));
                                setPatientGender(patient.patientGender);
                                setPatientBloodGroup(patient.patientBloodGroup || 'Unknown');
                                setAttendantRelation(patient.relationship || 'Guardian');
                                if (patient.emergencyContactPhone) setAttendantPhone(patient.emergencyContactPhone);
                                if (patient.medicalNotes) setPatientCondition(patient.medicalNotes);
                                setCurrentScreen('selection');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00707E] hover:bg-[#005B66] text-white text-xs font-bold transition-all shadow-2xs"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                              <span>Open Emergency Case</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemovePatientLink(patient.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                              title="Unlink this patient"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Unlink</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TRACK REQUESTS */}
              {dashboardTab === 'track' && (
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#00707E]" />
                        <span>Live Resource Request Tracker</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Real-time status of bed allocations, ICU bookings, blood requisitions, and ambulance routes
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDashboardTab('cases')}
                      className="text-xs font-bold text-[#00707E] hover:underline"
                    >
                      ← Back to Cases
                    </button>
                  </div>

                  {casesList.length === 0 ? (
                    <div className="text-center py-12 px-4 max-w-md mx-auto">
                      <div className="h-14 w-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto mb-3">
                        <Activity className="h-7 w-7" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">No Active Resource Requests</h3>
                      <p className="text-xs text-slate-500 mt-1 mb-5">
                        When you open an emergency case, requested resources will display their multi-stage verification and dispatch timeline here.
                      </p>
                      {linkedPatients.length > 0 ? (
                        <button
                          type="button"
                          onClick={handleCreateNewCase}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-xs shadow-sm transition-all"
                        >
                          <PlusCircle className="h-4 w-4" />
                          <span>Create Emergency Case</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsLinkPatientModalOpen(true)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-bold text-xs shadow-sm transition-all"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>Link Patient First</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {casesList.flatMap((c) =>
                        (c.individualStatuses || []).map((statusItem, idx) => (
                          <div key={`${c.caseId}-${idx}`} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">{statusItem.resource}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                                {statusItem.status}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  statusItem.code === 'dispatched'
                                    ? 'bg-emerald-600 w-full'
                                    : statusItem.code === 'reserved'
                                    ? 'bg-teal-600 w-3/4'
                                    : 'bg-amber-500 w-1/2'
                                }`}
                              />
                            </div>
                            <p className="text-xs text-slate-600">{statusItem.detail}</p>
                            <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex justify-between">
                              <span className="font-mono">{c.caseId}</span>
                              <span>{c.patientName}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS */}
              {dashboardTab === 'notifications' && (
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Bell className="h-5 w-5 text-[#00707E]" />
                        <span>Dispatch Notifications</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Live alerts from hospitals, ambulance pilots, and triage coordinators
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDashboardTab('cases')}
                      className="text-xs font-bold text-[#00707E] hover:underline"
                    >
                      ← Back to Cases
                    </button>
                  </div>

                  {casesList.length === 0 ? (
                    <div className="text-center py-10 px-4 max-w-md mx-auto">
                      <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <Bell className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">No Notifications</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        All caught up. Live dispatch notifications and triage alerts will appear here when an emergency case is initiated.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {casesList.map((c) => (
                        <div key={c.caseId} className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex items-start gap-3">
                          <div className="h-8 w-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                            <Check className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">Case {c.caseId} Active Dispatch</span>
                              <span className="text-[10px] text-slate-400">{c.createdAt}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Emergency dispatch ongoing for {c.patientName} at {c.providerName}.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: EMERGENCY HISTORY */}
              {dashboardTab === 'history' && (
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <History className="h-5 w-5 text-[#00707E]" />
                        <span>Emergency History & Archive</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Archived medical intake logs and past resolved emergency admissions
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDashboardTab('cases')}
                      className="text-xs font-bold text-[#00707E] hover:underline"
                    >
                      ← Back to Cases
                    </button>
                  </div>

                  {(() => {
                    const resolvedCases = casesList.filter((c) => c.status === 'Completed');
                    return resolvedCases.length === 0 ? (
                      <div className="text-center py-10 px-4 max-w-md mx-auto">
                        <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-3">
                          <History className="h-6 w-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm">No Resolved Emergency History</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Past emergency cases that have been marked as resolved will be archived here for clinical records.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {resolvedCases.map((rc) => (
                          <div key={rc.caseId} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-800">{rc.caseId}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                Resolved • {rc.dateStr}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700">
                              Patient: {rc.patientName} ({rc.patientAge}y) • {rc.patientCondition} • Handled at {rc.providerName}.
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 5: PROFILE SETTINGS */}
              {dashboardTab === 'profile' && (
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Settings className="h-5 w-5 text-[#00707E]" />
                        <span>Attendant & Profile Settings</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Primary attendant credentials and registered emergency contacts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDashboardTab('cases')}
                      className="text-xs font-bold text-[#00707E] hover:underline"
                    >
                      ← Back to Cases
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-400 uppercase font-bold text-[10px]">Registered Attendant</span>
                      <p className="font-bold text-slate-900 text-sm">{currentUser?.displayName || 'Sahana S.'}</p>
                      <p className="text-slate-600">Email: {currentUser?.email || 'sahana2006@gmail.com'}</p>
                      <p className="text-[#00707E] font-bold">Role: Patient Attendant</p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-400 uppercase font-bold text-[10px]">Authorized Patient Network</span>
                      <p className="font-bold text-slate-900 text-sm">{linkedPatients.length} Linked Patient{linkedPatients.length === 1 ? '' : 's'}</p>
                      <p className="text-slate-600">
                        {linkedPatients.length > 0
                          ? linkedPatients.map((p) => p.patientName).join(', ')
                          : 'No patients linked yet'}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-400 uppercase font-bold text-[10px]">Emergency Contact Phone</span>
                      <p className="font-bold text-slate-900 text-sm">
                        {linkedPatients[0]?.emergencyContactPhone || '+91 98451 98765'}
                      </p>
                      <p className="text-emerald-700 font-semibold">SMS Dispatch Alerts Enabled</p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-400 uppercase font-bold text-[10px]">Security Status</span>
                      <p className="font-bold text-emerald-700 text-sm">CareBridge Verified Attendant</p>
                      <p className="text-slate-600 truncate font-mono text-[11px]">UID: {currentUser?.uid || 'authenticated'}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Mandatory Availability Disclaimer */}
            <div className="text-center py-4 text-xs sm:text-sm text-slate-600 font-medium border-t border-slate-200 bg-white/60">
              *All availability data is real-time and reported by registered providers.*
            </div>

            {/* ============================================================== */}
            {/* INTERACTIVE CASE DETAILS MODAL (Task 1.7 Requirement 5)         */}
            {/* ============================================================== */}
            {selectedDashboardCase && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-7 border border-slate-100 max-h-[90vh] overflow-y-auto">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#00707E] flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                          Emergency Case Record & Dossier
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">Case ID: {selectedDashboardCase.caseId}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDashboardCase(null)}
                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Priority & Status Banner */}
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wide block">
                        Triage Priority
                      </span>
                      <div className="mt-1">
                        {getTriageBadge(selectedDashboardCase.triagePriority)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                        Case Status
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-teal-300 text-teal-800 inline-block mt-1">
                        {selectedDashboardCase.status || 'Active Dispatch'}
                      </span>
                    </div>
                  </div>

                  {/* Patient & Attendant Dossier */}
                  <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4">
                    <div>
                      <span className="text-slate-500 font-medium">Patient:</span>{' '}
                      <span className="font-bold text-slate-900">{selectedDashboardCase.patientName}</span> ({selectedDashboardCase.patientAge} years, {selectedDashboardCase.patientGender})
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Blood Group:</span>{' '}
                      <span className="font-bold text-red-600">{selectedDashboardCase.patientBloodGroup}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Condition & Complaint:</span>{' '}
                      <span className="font-semibold text-slate-900">{selectedDashboardCase.patientCondition}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Clinical Description:</span>{' '}
                      <span className="text-slate-700">{selectedDashboardCase.emergencyDescription}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Attendant:</span>{' '}
                      <span className="font-semibold text-slate-900">{selectedDashboardCase.attendantName}</span> ({selectedDashboardCase.attendantRelation}) • {selectedDashboardCase.attendantPhone}
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Incident Location:</span>{' '}
                      <span className="font-semibold text-slate-900">{selectedDashboardCase.incidentAddress}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Assigned Provider:</span>{' '}
                      <span className="font-bold text-[#00707E]">{selectedDashboardCase.providerName}</span>
                    </div>
                  </div>

                  {/* Individual Resource Requests for this case */}
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Associated Resource Requests
                    </h4>
                    <div className="space-y-2">
                      {selectedDashboardCase.individualStatuses?.map((item) => (
                        <div
                          key={item.resource}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{item.resource}</span>
                            <p className="text-[11px] text-slate-500">{item.detail}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 whitespace-nowrap">
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {selectedDashboardCase.status !== 'Completed' && (
                      <button
                        type="button"
                        onClick={() => handleMarkCaseCompleted(selectedDashboardCase.caseId)}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition-colors shadow-xs flex items-center justify-center gap-2"
                      >
                        <CheckCheck className="h-4 w-4" />
                        <span>Mark Case as Resolved / Completed</span>
                      </button>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyCaseId(selectedDashboardCase.caseId)}
                        className="flex-1 py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copiedCaseId ? 'Copied!' : 'Copy Case ID'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDashboardCase(null)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white font-semibold text-xs transition-colors shadow-xs"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* REGISTER / LINK PATIENT MODAL (Task 1.7 Requirement 2)          */}
            {/* ============================================================== */}
            {isLinkPatientModalOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 border border-slate-100 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#00707E] flex items-center justify-center">
                        <UserPlus className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                          Link Patient to Your Profile
                        </h3>
                        <p className="text-xs text-slate-500">
                          Attendant: {currentUser?.displayName || 'Sahana S.'} ({currentUser?.email || 'sahana2006@gmail.com'})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLinkPatientModalOpen(false)}
                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleLinkPatientSubmit} className="space-y-4">
                    {Object.keys(linkPatientErrors).length > 0 && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                        {Object.values(linkPatientErrors).map((msg, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                            <span>{msg}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Patient Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newPatientName}
                        onChange={(e) => {
                          setNewPatientName(e.target.value);
                          if (linkPatientErrors.name) setLinkPatientErrors((prev) => ({ ...prev, name: '' }));
                        }}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Relationship to Attendant <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={newPatientRelation}
                          onChange={(e) => setNewPatientRelation(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                        >
                          <option value="Parent">Parent</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Child">Child</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Grandparent">Grandparent</option>
                          <option value="Guardian">Guardian</option>
                          <option value="Friend">Friend</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Age (Years) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="125"
                          required
                          value={newPatientAge}
                          onChange={(e) => {
                            setNewPatientAge(e.target.value);
                            if (linkPatientErrors.age) setLinkPatientErrors((prev) => ({ ...prev, age: '' }));
                          }}
                          placeholder="e.g. 45"
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={newPatientGender}
                          onChange={(e) => setNewPatientGender(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Blood Group
                        </label>
                        <select
                          value={newPatientBloodGroup}
                          onChange={(e) => setNewPatientBloodGroup(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                        >
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Emergency Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={newPatientPhone}
                        onChange={(e) => setNewPatientPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Known Medical Notes / Allergies / Conditions
                      </label>
                      <textarea
                        rows={2}
                        value={newPatientNotes}
                        onChange={(e) => setNewPatientNotes(e.target.value)}
                        placeholder="e.g. Hypertension, asthma, penicillin allergy"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] font-medium text-slate-900"
                      />
                    </div>

                    {/* Patient Consent Verification */}
                    <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="newPatientConsent"
                          required
                          checked={newPatientConsent}
                          onChange={(e) => {
                            setNewPatientConsent(e.target.checked);
                            if (linkPatientErrors.consent) setLinkPatientErrors((prev) => ({ ...prev, consent: '' }));
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-teal-400 text-[#00707E] focus:ring-[#00707E]"
                        />
                        <label htmlFor="newPatientConsent" className="text-xs text-slate-700 leading-snug cursor-pointer">
                          <span className="font-bold text-slate-900 block flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
                            <span>Patient Consent Verification <span className="text-red-500">*</span></span>
                          </span>
                          I verify that explicit consent has been granted by the patient (or their legal guardian) authorizing me to access their medical dossier and coordinate emergency healthcare resources on CareBridge.
                        </label>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLinkPatientModalOpen(false)}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLinkingSubmitting}
                        className="px-5 py-2 rounded-xl bg-[#00707E] hover:bg-[#005B66] disabled:opacity-60 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        {isLinkingSubmitting ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Save & Link Patient</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        );
      })()
      )}

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CareBridgeApp />
    </AuthProvider>
  );
}

