/**
 * CareBridge Data Service
 * Unified service layer for Firestore + Demo / Presentation Store
 *
 * Implements full cross-role synchrony:
 * Patient creates case -> sends request -> Provider sees incoming request ->
 * Provider accepts/rejects -> Patient sees status change in real time ->
 * Ambulance trip progression -> Notifications created at every step.
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  updateDoc,
  deleteField,
  onSnapshot,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  type Unsubscribe
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import type {
  EmergencyCase,
  ResourceRequest,
  HospitalProfile,
  BloodBankProfile,
  OxygenProfile,
  AmbulanceProfile,
  AmbulanceTrip,
  NotificationItem,
  UserProfile,
  UserRole,
  ClinicalNote,
  AmbulanceTripStatus,
  PatientLink,
  CaseStatus,
  EmergencyServiceStatus,
  ResourceAssignmentAudit,
  EmergencyLifecycleEvent,
  EmergencyLifecycleStatus
} from '../types';

export interface ResourceRequestDraft {
  resourceType: ResourceRequest['resourceType'];
  providerRole: UserRole;
  details: ResourceRequest['details'];
}

interface ProviderDirectoryEntry {
  uid: string;
  role: UserRole;
  displayName: string;
  city: string;
  hospitalAffiliation?: string;
  isVerified: boolean;
  isActive: boolean;
}

export interface EligibleResourceProvider extends ProviderDirectoryEntry {
  state?: string;
}

export interface PatientAttendantLink {
  attendantUid: string;
  activeConsent: boolean;
  updatedAt: string;
}

const firestoreDateToIso = (value: unknown): string => {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate() as Date;
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  throw new Error('A Firestore emergency record has an invalid timestamp.');
};

const normalizeLifecycleHistory = (
  value: unknown
): Record<string, EmergencyLifecycleEvent> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).map(([eventId, event]) => {
      if (!event || typeof event !== 'object') {
        throw new Error('A lifecycle history entry is invalid.');
      }
      const item = event as Record<string, unknown>;
      return [eventId, {
        ...item,
        eventId: typeof item.eventId === 'string' ? item.eventId : eventId,
        timestamp: firestoreDateToIso(item.timestamp)
      } as EmergencyLifecycleEvent];
    })
  );
};

const normalizeEmergencyCase = (data: Record<string, unknown>, caseId: string): EmergencyCase => ({
  ...data,
  caseId: typeof data.caseId === 'string' ? data.caseId : caseId,
  createdAt: firestoreDateToIso(data.createdAt),
  updatedAt: data.updatedAt ? firestoreDateToIso(data.updatedAt) : undefined,
  lifecycleHistory: normalizeLifecycleHistory(data.lifecycleHistory)
} as EmergencyCase);

const normalizeResourceRequest = (data: Record<string, unknown>, requestId: string): ResourceRequest => ({
  ...data,
  requestId: typeof data.requestId === 'string' ? data.requestId : requestId,
  createdAt: firestoreDateToIso(data.createdAt),
  updatedAt: data.updatedAt ? firestoreDateToIso(data.updatedAt) : '',
  assignedAt: data.assignedAt ? firestoreDateToIso(data.assignedAt) : undefined,
  respondedAt: data.respondedAt ? firestoreDateToIso(data.respondedAt) : undefined,
  statusHistory: normalizeLifecycleHistory(data.statusHistory)
} as ResourceRequest);

const CASE_STATUS_TRANSITIONS: Record<string, EmergencyLifecycleStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
  Submitted: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
  active: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['ASSIGNED', 'REJECTED', 'CANCELLED'],
  'Under Review': ['ASSIGNED', 'REJECTED', 'CANCELLED'],
  ASSIGNED: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['RESOURCE_CONFIRMED', 'REJECTED', 'CANCELLED'],
  RESOURCE_CONFIRMED: ['DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  DISPATCHED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED']
};

const notificationDocumentId = (eventId: string, recipientUid: string): string =>
  `${eventId}_${recipientUid}`;

export function getAllowedEmergencyCaseTransitions(status: string): EmergencyLifecycleStatus[] {
  return CASE_STATUS_TRANSITIONS[status] || [];
}

// ==========================================
// SEEDED DEMO DATASET
// ==========================================

export const DEMO_USERS: UserProfile[] = [
  {
    uid: 'attendant-sahana-01',
    email: 'sahana2006@gmail.com',
    displayName: 'Sahana S.',
    role: 'patientAttendant',
    phone: '+91 98451 98765',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'PB Road, Vidyanagar, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'patient-demo-01',
    email: 'patient@carebridge.org',
    displayName: 'Rahul Deshpande',
    role: 'patient',
    phone: '+91 98451 98765',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Plot 42, Vidyanagar Main Road, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'hosp-demo-01',
    email: 'hospital@carebridge.org',
    displayName: 'KIMS Super Specialty Hospital',
    role: 'hospital',
    phone: '+91 836 222 5555',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Vidyanagar, PB Road, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'blood-demo-01',
    email: 'bloodbank@carebridge.org',
    displayName: 'Red Cross Regional Blood Centre',
    role: 'bloodBank',
    phone: '+91 836 237 1234',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Club Road, Deshpande Nagar, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'oxy-demo-01',
    email: 'oxygen@carebridge.org',
    displayName: 'OxyLife Medical Gas Distributors',
    role: 'oxygenProvider',
    phone: '+91 836 244 8899',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Gokul Road Industrial Area, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'amb-demo-01',
    email: 'ambulance@carebridge.org',
    displayName: 'SwiftCare Emergency Ambulance Fleet',
    role: 'ambulanceProvider',
    phone: '+91 836 225 1080',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Station Road, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'doctor-demo-01',
    email: 'doctor@carebridge.org',
    displayName: 'Dr. Priya Deshmukh (Cardiology)',
    role: 'doctor',
    phone: '+91 98450 12345',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'KIMS Staff Quarters, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    hospitalAffiliation: 'KIMS Super Specialty Hospital',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'admin-demo-01',
    email: 'admin@carebridge.org',
    displayName: 'CareBridge Central Coordinator',
    role: 'admin',
    phone: '+91 80 4000 8000',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: 'CareBridge Command Center, MG Road',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  }
];

export const INITIAL_HOSPITAL: HospitalProfile = {
  uid: 'hosp-demo-01',
  hospitalName: 'KIMS Super Specialty Hospital',
  registrationNumber: 'KA-HUB-HOSP-2024-0091',
  departments: ['Emergency Trauma', 'Critical Care / ICU', 'Cardiology', 'Pulmonology', 'Neurology'],
  totalBeds: 250,
  availableBeds: 42,
  totalICU: 30,
  availableICU: 6,
  totalVentilators: 18,
  availableVentilators: 4,
  contactNumber: '+91 836 222 5555',
  operatingHours: '24/7 Round the Clock',
  city: 'Hubballi',
  state: 'Karnataka',
  address: 'Vidyanagar, PB Road, Hubballi',
  isVerified: true,
  lastUpdated: new Date().toISOString()
};

export const INITIAL_BLOOD_BANK: BloodBankProfile = {
  uid: 'blood-demo-01',
  bankName: 'Red Cross Regional Blood Centre',
  licenseNumber: 'KA-BB-2023-0142',
  inventory: {
    'A+': 18,
    'A-': 5,
    'B+': 24,
    'B-': 3,
    'AB+': 9,
    'AB-': 2,
    'O+': 31,
    'O-': 6
  },
  contactNumber: '+91 836 237 1234',
  city: 'Hubballi',
  state: 'Karnataka',
  address: 'Club Road, Deshpande Nagar, Hubballi',
  isVerified: true,
  lastUpdated: new Date().toISOString()
};

export const INITIAL_OXYGEN: OxygenProfile = {
  uid: 'oxy-demo-01',
  providerName: 'OxyLife Medical Gas Distributors',
  licenseNumber: 'KA-OXY-2022-0089',
  cylindersAvailable: 35,
  concentratorsAvailable: 12,
  deliveryAvailable: true,
  contactNumber: '+91 836 244 8899',
  city: 'Hubballi',
  state: 'Karnataka',
  address: 'Gokul Road Industrial Area, Hubballi',
  isVerified: true,
  lastUpdated: new Date().toISOString()
};

export const INITIAL_AMBULANCE: AmbulanceProfile = {
  uid: 'amb-demo-01',
  providerName: 'SwiftCare Emergency Ambulance Fleet',
  licenseNumber: 'KA-AMB-2024-0311',
  contactNumber: '+91 836 225 1080',
  city: 'Hubballi',
  state: 'Karnataka',
  address: 'Station Road, Hubballi',
  isVerified: true,
  vehicles: [
    {
      vehicleId: 'KA-25-EM-1081',
      vehicleType: 'ALS',
      driverName: 'Ramesh Patil',
      driverPhone: '+91 98452 11081',
      isAvailable: false,
      currentStatus: 'on_trip'
    },
    {
      vehicleId: 'KA-25-EM-1082',
      vehicleType: 'BLS',
      driverName: 'Suresh Angadi',
      driverPhone: '+91 98452 11082',
      isAvailable: true,
      currentStatus: 'idle'
    },
    {
      vehicleId: 'KA-25-EM-1083',
      vehicleType: 'Patient Transport',
      driverName: 'Vinod Kulkarni',
      driverPhone: '+91 98452 11083',
      isAvailable: true,
      currentStatus: 'idle'
    }
  ],
  lastUpdated: new Date().toISOString()
};

export const INITIAL_CASES: EmergencyCase[] = [
  {
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    patientAge: 42,
    patientGender: 'Male',
    conditionSummary: 'Acute chest pain radiating to left arm with dyspnea & diaphoresis',
    urgencyLevel: 'immediate',
    resourcesNeeded: ['bed', 'icu', 'blood', 'oxygen', 'ambulance'],
    location: {
      city: 'Hubballi',
      address: 'Plot 42, Vidyanagar Main Road, Hubballi',
      state: 'Karnataka'
    },
    attendant: {
      name: 'Suresh Deshpande',
      relation: 'Brother',
      phone: '+91 98451 98765'
    },
    status: 'active',
    requestCount: 4,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_REQUESTS: ResourceRequest[] = [
  {
    requestId: 'REQ-20261108-0101',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    requesterUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    providerUid: 'hosp-demo-01',
    providerName: 'KIMS Super Specialty Hospital',
    resourceType: 'bed',
    details: { bedType: 'ICU Cardiac Bed', notes: 'Immediate admission needed' },
    status: 'accepted',
    respondedAt: new Date(Date.now() - 2800000).toISOString(),
    createdAt: new Date(Date.now() - 3500000).toISOString(),
    updatedAt: new Date(Date.now() - 2800000).toISOString()
  },
  {
    requestId: 'REQ-20261108-0102',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    requesterUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    providerUid: 'blood-demo-01',
    providerName: 'Red Cross Regional Blood Centre',
    resourceType: 'blood',
    details: { bloodGroup: 'B+', units: 2, notes: 'Emergency transfusion standby' },
    status: 'accepted',
    respondedAt: new Date(Date.now() - 2500000).toISOString(),
    createdAt: new Date(Date.now() - 3400000).toISOString(),
    updatedAt: new Date(Date.now() - 2500000).toISOString()
  },
  {
    requestId: 'REQ-20261108-0103',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    requesterUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    providerUid: 'oxy-demo-01',
    providerName: 'OxyLife Medical Gas Distributors',
    resourceType: 'oxygen',
    details: { cylinders: 2, concentrators: 0, notes: 'High flow oxygen mask required' },
    status: 'accepted',
    respondedAt: new Date(Date.now() - 2200000).toISOString(),
    createdAt: new Date(Date.now() - 3300000).toISOString(),
    updatedAt: new Date(Date.now() - 2200000).toISOString()
  },
  {
    requestId: 'REQ-20261108-0104',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    requesterUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    providerUid: 'amb-demo-01',
    providerName: 'SwiftCare Emergency Ambulance Fleet',
    resourceType: 'ambulance',
    details: {
      vehicleType: 'ALS Cardiac Ambulance',
      pickupAddress: 'Plot 42, Vidyanagar Main Road, Hubballi',
      destinationAddress: 'KIMS Super Specialty Hospital, PB Road'
    },
    status: 'accepted',
    respondedAt: new Date(Date.now() - 2000000).toISOString(),
    createdAt: new Date(Date.now() - 3200000).toISOString(),
    updatedAt: new Date(Date.now() - 2000000).toISOString()
  }
];

export const INITIAL_TRIPS: AmbulanceTrip[] = [
  {
    tripId: 'TRIP-20261108-0001',
    requestId: 'REQ-20261108-0104',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    providerUid: 'amb-demo-01',
    vehicleId: 'KA-25-EM-1081',
    vehicleType: 'ALS Cardiac Ambulance',
    driverName: 'Ramesh Patil',
    driverPhone: '+91 98452 11081',
    pickupLocation: {
      address: 'Plot 42, Vidyanagar Main Road, Hubballi',
      city: 'Hubballi'
    },
    destinationLocation: {
      address: 'KIMS Super Specialty Hospital, PB Road, Hubballi',
      city: 'Hubballi'
    },
    status: 'en_route',
    statusHistory: [
      { status: 'dispatched', timestamp: new Date(Date.now() - 1800000).toISOString(), note: 'Ambulance dispatched from station' },
      { status: 'en_route', timestamp: new Date(Date.now() - 900000).toISOString(), note: 'Vehicle en route to patient location, ETA 6 mins' }
    ],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString()
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-01',
    recipientUid: 'patient-demo-01',
    type: 'ambulance_updated',
    title: 'Ambulance En Route',
    message: 'ALS Ambulance (KA-25-EM-1081) driven by Ramesh Patil is en route. ETA: 6 mins.',
    relatedCaseId: 'CB-20261108-0042',
    relatedRequestId: 'REQ-20261108-0104',
    isRead: false,
    createdAt: new Date(Date.now() - 900000).toISOString()
  },
  {
    id: 'notif-02',
    recipientUid: 'patient-demo-01',
    type: 'request_accepted',
    title: 'ICU Bed Confirmed',
    message: 'KIMS Super Specialty Hospital has confirmed your ICU cardiac bed admission.',
    relatedCaseId: 'CB-20261108-0042',
    relatedRequestId: 'REQ-20261108-0101',
    isRead: true,
    createdAt: new Date(Date.now() - 2800000).toISOString()
  },
  {
    id: 'notif-03',
    recipientUid: 'hosp-demo-01',
    type: 'request_received',
    title: 'Emergency Admission Request',
    message: 'New critical case CB-20261108-0042 (Rahul Deshpande, 42M) requires an ICU bed.',
    relatedCaseId: 'CB-20261108-0042',
    relatedRequestId: 'REQ-20261108-0101',
    isRead: true,
    createdAt: new Date(Date.now() - 3500000).toISOString()
  }
];

// ==========================================
// UNIFIED DATA STORE (Reactive Singleton)
// ==========================================

const STORAGE_KEY = 'carebridge_unified_store_v2';
const PROVIDER_ROLES: UserRole[] = ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider', 'doctor'];
const ATTENDANT_ROLES: UserRole[] = ['patientAttendant', 'patient_attendant', 'attendant'];

interface StoreState {
  users: UserProfile[];
  cases: EmergencyCase[];
  requests: ResourceRequest[];
  trips: AmbulanceTrip[];
  notifications: NotificationItem[];
  hospitalProfiles: Record<string, HospitalProfile>;
  bloodBankProfiles: Record<string, BloodBankProfile>;
  oxygenProfiles: Record<string, OxygenProfile>;
  ambulanceProfiles: Record<string, AmbulanceProfile>;
  clinicalNotes: ClinicalNote[];
  patientLinks: PatientLink[];
}

type Listener = () => void;

class DataStore {
  private state: StoreState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): StoreState {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (!parsed.patientLinks) parsed.patientLinks = [];
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved store, using default demo seed:', e);
    }

    return {
      users: [...DEMO_USERS],
      cases: [...INITIAL_CASES],
      requests: [...INITIAL_REQUESTS],
      trips: [...INITIAL_TRIPS],
      notifications: [...INITIAL_NOTIFICATIONS],
      hospitalProfiles: { [INITIAL_HOSPITAL.uid]: INITIAL_HOSPITAL },
      bloodBankProfiles: { [INITIAL_BLOOD_BANK.uid]: INITIAL_BLOOD_BANK },
      oxygenProfiles: { [INITIAL_OXYGEN.uid]: INITIAL_OXYGEN },
      ambulanceProfiles: { [INITIAL_AMBULANCE.uid]: INITIAL_AMBULANCE },
      clinicalNotes: [],
      patientLinks: []
    };
  }

  private saveState() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.error('Failed to save store to localStorage:', e);
    }
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Error notifying listener:', err);
      }
    });
  }

  public resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.loadState();
    this.notify();
  }

  // --- Users & Profiles ---
  public getUsers(): UserProfile[] {
    return [...this.state.users];
  }

  public getUser(uid: string): UserProfile | undefined {
    return this.state.users.find((u) => u.uid === uid);
  }

  public saveUser(user: UserProfile) {
    const idx = this.state.users.findIndex((u) => u.uid === user.uid);
    if (idx >= 0) {
      this.state.users[idx] = { ...user, updatedAt: new Date().toISOString() };
    } else {
      this.state.users.push(user);
    }
    this.saveState();
  }

  public async toggleUserActive(uid: string, isActive: boolean): Promise<void> {
    if (!isFirebaseConfigured || !db || !auth.currentUser) {
      throw new Error('An authenticated Firebase administrator is required to change account status.');
    }

    const adminSnapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!adminSnapshot.exists() || adminSnapshot.data().role !== 'admin') {
      throw new Error('Only an authorized administrator can change account status.');
    }

    const userRef = doc(db, 'users', uid);
    const userSnapshot = await getDoc(userRef);
    if (!userSnapshot.exists()) {
      throw new Error('The account could not be found.');
    }

    const profile = userSnapshot.data() as UserProfile;
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(userRef, { isActive, updatedAt: now });
    if (PROVIDER_ROLES.includes(profile.role)) {
      batch.set(
        doc(db, 'providerDirectory', uid),
        {
          uid,
          role: profile.role,
          displayName: profile.displayName,
          city: profile.city,
          hospitalAffiliation: profile.hospitalAffiliation || '',
          isVerified: profile.isVerified,
          isActive,
          updatedAt: now
        },
        { merge: true }
      );
    }
    await batch.commit();

    const user = this.state.users.find((u) => u.uid === uid);
    if (user) {
      user.isActive = isActive;
      user.updatedAt = now;
      this.saveState();
    }
  }

  public async verifyProvider(uid: string, isVerified: boolean): Promise<void> {
    if (!isFirebaseConfigured || !db || !auth.currentUser) {
      throw new Error('An authenticated Firebase administrator is required to change provider verification.');
    }

    const adminSnapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!adminSnapshot.exists() || adminSnapshot.data().role !== 'admin') {
      throw new Error('Only an authorized administrator can change provider verification.');
    }

    const providerRef = doc(db, 'users', uid);
    const providerSnapshot = await getDoc(providerRef);
    if (!providerSnapshot.exists()) {
      throw new Error('The provider account could not be found.');
    }

    const provider = providerSnapshot.data() as UserProfile;
    if (!PROVIDER_ROLES.includes(provider.role)) {
      throw new Error('Verification can only be changed for provider accounts.');
    }

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(providerRef, { isVerified, updatedAt: now });
    batch.set(
      doc(db, 'providerDirectory', uid),
      {
        uid,
        role: provider.role,
        displayName: provider.displayName,
        city: provider.city,
        hospitalAffiliation: provider.hospitalAffiliation || '',
        isVerified,
        isActive: provider.isActive,
        updatedAt: now
      },
      { merge: true }
    );
    await batch.commit();

    const user = this.state.users.find((u) => u.uid === uid);
    if (user) {
      user.isVerified = isVerified;
      user.updatedAt = now;
      if (this.state.hospitalProfiles[uid]) this.state.hospitalProfiles[uid].isVerified = isVerified;
      if (this.state.bloodBankProfiles[uid]) this.state.bloodBankProfiles[uid].isVerified = isVerified;
      if (this.state.oxygenProfiles[uid]) this.state.oxygenProfiles[uid].isVerified = isVerified;
      if (this.state.ambulanceProfiles[uid]) this.state.ambulanceProfiles[uid].isVerified = isVerified;

      this.state.notifications.unshift({
        id: 'notif-' + Date.now(),
        recipientUid: uid,
        type: 'provider_verified',
        title: isVerified ? 'Provider Profile Verified' : 'Provider Verification Revoked',
        message: isVerified
          ? 'Your healthcare provider organization has been verified by the CareBridge Coordinator.'
          : 'Your provider credentials require re-verification. Contact the administrator.',
        isRead: false,
        createdAt: now
      });
      this.saveState();
    }
  }

  // --- Provider Specific Profiles ---
  public getHospitalProfile(uid: string): HospitalProfile | undefined {
    return this.state.hospitalProfiles[uid] || Object.values(this.state.hospitalProfiles)[0];
  }

  public updateHospitalProfile(uid: string, updates: Partial<HospitalProfile>) {
    const current = this.state.hospitalProfiles[uid] || INITIAL_HOSPITAL;
    this.state.hospitalProfiles[uid] = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this.saveState();
  }

  public getBloodBankProfile(uid: string): BloodBankProfile | undefined {
    return this.state.bloodBankProfiles[uid] || Object.values(this.state.bloodBankProfiles)[0];
  }

  public updateBloodBankProfile(uid: string, updates: Partial<BloodBankProfile>) {
    const current = this.state.bloodBankProfiles[uid] || INITIAL_BLOOD_BANK;
    this.state.bloodBankProfiles[uid] = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this.saveState();
  }

  public getOxygenProfile(uid: string): OxygenProfile | undefined {
    return this.state.oxygenProfiles[uid] || Object.values(this.state.oxygenProfiles)[0];
  }

  public updateOxygenProfile(uid: string, updates: Partial<OxygenProfile>) {
    const current = this.state.oxygenProfiles[uid] || INITIAL_OXYGEN;
    this.state.oxygenProfiles[uid] = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this.saveState();
  }

  public getAmbulanceProfile(uid: string): AmbulanceProfile | undefined {
    return this.state.ambulanceProfiles[uid] || Object.values(this.state.ambulanceProfiles)[0];
  }

  public updateAmbulanceProfile(uid: string, updates: Partial<AmbulanceProfile>) {
    const current = this.state.ambulanceProfiles[uid] || INITIAL_AMBULANCE;
    this.state.ambulanceProfiles[uid] = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this.saveState();
  }

  public getDoctorProfile(uid: string): UserProfile | undefined {
    const user = this.getUser(uid);
    return user?.role === 'doctor' ? user : (this.getUsers().find(u => u.role === 'doctor'));
  }

  public getAllHospitalProfiles(): HospitalProfile[] {
    return Object.values(this.state.hospitalProfiles);
  }

  public getAllBloodBankProfiles(): BloodBankProfile[] {
    return Object.values(this.state.bloodBankProfiles);
  }

  public getAllOxygenProfiles(): OxygenProfile[] {
    return Object.values(this.state.oxygenProfiles);
  }

  public getAllAmbulanceProfiles(): AmbulanceProfile[] {
    return Object.values(this.state.ambulanceProfiles);
  }

  // --- Patient Links (Attendant <-> Patient Relationship) ---
  public getPatientLinks(attendantUid: string): PatientLink[] {
    return (this.state.patientLinks || []).filter((l) => l.attendantUid === attendantUid);
  }

  public savePatientLink(link: PatientLink) {
    if (!this.state.patientLinks) this.state.patientLinks = [];
    const idx = this.state.patientLinks.findIndex((l) => l.id === link.id);
    if (idx >= 0) {
      this.state.patientLinks[idx] = { ...link, updatedAt: new Date().toISOString() };
    } else {
      this.state.patientLinks.unshift(link);
    }
    this.saveState();
  }

  public deletePatientLink(linkId: string) {
    if (!this.state.patientLinks) return;
    this.state.patientLinks = this.state.patientLinks.filter((l) => l.id !== linkId);
    this.saveState();
  }

  // --- Emergency Cases ---
  public getCases(): EmergencyCase[] {
    return [...this.state.cases];
  }

  public getCasesForPatient(patientUid: string): EmergencyCase[] {
    return this.state.cases.filter((c) => c.patientUid === patientUid);
  }

  public getCasesForAttendant(attendantUid: string, linkedPatientUids: string[] = []): EmergencyCase[] {
    // Strictly retrieve only cases associated with this attendant UID or their authorized, consented linked patients
    const consentedPatientUids = this.getPatientLinks(attendantUid)
      .filter((l) => l.consentGranted === true && l.consentStatus === 'granted')
      .map((l) => l.patientUid);

    return this.state.cases.filter((c) => {
      if (c.attendantUid === attendantUid) return true;
      if (c.attendant && c.attendant.uid === attendantUid) return true;
      if (c.patientUid === attendantUid) return true;
      if (c.requesterUid === attendantUid) return true;
      // Accessing patient's records strictly requires verified patient consent
      if (consentedPatientUids.includes(c.patientUid) && linkedPatientUids.includes(c.patientUid)) return true;
      return false;
    });
  }

  public getCase(caseId: string): EmergencyCase | undefined {
    return this.state.cases.find((c) => c.caseId === caseId);
  }

  public subscribeToCoordinatorCasesAndRequests(
    onUsers: (users: UserProfile[]) => void,
    onCases: (cases: EmergencyCase[]) => void,
    onRequests: (requests: ResourceRequest[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      onError('Coordinator emergency data requires a configured Firebase project.');
      return () => undefined;
    }
    if (!auth.currentUser) {
      onError('Sign in with an authorized coordinator account to view emergency data.');
      return () => undefined;
    }

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      try {
        onUsers(snapshot.docs.map((userSnapshot) => {
          const data = userSnapshot.data();
          return {
            ...data,
            uid: data.uid || userSnapshot.id,
            email: data.email || '',
            displayName: data.displayName || '',
            city: data.city || '',
            state: data.state || '',
            isVerified: data.isVerified === true,
            isActive: data.isActive === true,
            profileComplete: data.profileComplete === true,
            createdAt: data.createdAt ? firestoreDateToIso(data.createdAt) : '',
            updatedAt: data.updatedAt ? firestoreDateToIso(data.updatedAt) : ''
          } as UserProfile;
        }));
      } catch (error) {
        onError(error instanceof Error ? error.message : 'The user directory contains invalid data.');
      }
    }, (error) => {
      onError(`Could not load user directory: ${error.message}`);
    });

    const unsubscribeCases = onSnapshot(collection(db, 'cases'), (snapshot) => {
      try {
        onCases(snapshot.docs.map((caseSnapshot) =>
          normalizeEmergencyCase(caseSnapshot.data(), caseSnapshot.id)
        ));
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Emergency cases could not be read.');
      }
    }, (error) => {
      onError(`Could not load emergency cases: ${error.message}`);
    });

    const unsubscribeRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      try {
        onRequests(snapshot.docs.map((requestSnapshot) =>
          normalizeResourceRequest(requestSnapshot.data(), requestSnapshot.id)
        ));
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Resource requests could not be read.');
      }
    }, (error) => {
      onError(`Could not load resource requests: ${error.message}`);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeCases();
      unsubscribeRequests();
    };
  }

  public async getEligibleResourceProviders(
    resourceType: ResourceRequest['resourceType'],
    location?: { city?: string; state?: string }
  ): Promise<EligibleResourceProvider[]> {
    if (!isFirebaseConfigured || !db || !auth.currentUser) {
      throw new Error('Sign in to an authenticated coordinator account to load eligible providers.');
    }

    const roleByResource: Record<ResourceRequest['resourceType'], UserRole> = {
      bed: 'hospital',
      icu: 'hospital',
      hospital_admission: 'hospital',
      blood: 'bloodBank',
      oxygen: 'oxygenProvider',
      ambulance: 'ambulanceProvider',
      doctor: 'doctor',
      doctor_assistance: 'doctor'
    };
    const requiredRole = roleByResource[resourceType];
    const providerSnapshot = await getDocs(
      query(collection(db, 'providerDirectory'), where('role', '==', requiredRole))
    );
    const eligible = await Promise.all(providerSnapshot.docs.map(async (providerSnapshotDoc): Promise<EligibleResourceProvider | null> => {
      const directory = providerSnapshotDoc.data();
      if (
        directory.uid !== providerSnapshotDoc.id ||
        directory.role !== requiredRole ||
        directory.isActive !== true ||
        directory.isVerified !== true
      ) return null;

      const userSnapshot = await getDoc(doc(db, 'users', providerSnapshotDoc.id));
      if (!userSnapshot.exists()) return null;
      const user = userSnapshot.data();
      if (
        user.role !== requiredRole ||
        user.isActive !== true ||
        user.isVerified !== true
      ) return null;

      const eligibleProvider: EligibleResourceProvider = {
        uid: providerSnapshotDoc.id,
        role: requiredRole,
        displayName: directory.displayName || user.displayName || '',
        city: directory.city || user.city || '',
        ...(directory.state || user.state ? { state: directory.state || user.state } : {}),
        isActive: true,
        isVerified: true
      };
      return eligibleProvider;
    }));

    const normalizedCity = location?.city?.trim().toLocaleLowerCase();
    const normalizedState = location?.state?.trim().toLocaleLowerCase();
    return eligible
      .filter((provider): provider is EligibleResourceProvider => provider !== null && Boolean(provider.displayName))
      .sort((a, b) => {
        const score = (provider: EligibleResourceProvider) =>
          Number(Boolean(normalizedCity) && provider.city.trim().toLocaleLowerCase() === normalizedCity) * 2 +
          Number(Boolean(normalizedState) && (provider.state || '').trim().toLocaleLowerCase() === normalizedState);
        return score(b) - score(a) || a.displayName.localeCompare(b.displayName);
      });
  }

  public subscribeToRequestAssignmentHistory(
    requestId: string,
    onHistory: (history: ResourceAssignmentAudit[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      onError('Assignment history requires a configured Firebase project.');
      return () => undefined;
    }

    return onSnapshot(
      query(collection(db, 'requests', requestId, 'assignmentHistory'), orderBy('timestamp', 'desc')),
      (snapshot) => {
        try {
          onHistory(snapshot.docs.map((auditSnapshot) => {
            const data = auditSnapshot.data();
            return {
              ...data,
              auditId: auditSnapshot.id,
              timestamp: firestoreDateToIso(data.timestamp)
            } as ResourceAssignmentAudit;
          }));
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Assignment history could not be read.');
        }
      },
      (error) => onError(`Could not load assignment history: ${error.message}`)
    );
  }

  public async assignResourceRequest(
    requestId: string,
    providerUid: string,
    reason: string
  ): Promise<void> {
    if (!isFirebaseConfigured || !db || !auth.currentUser) {
      throw new Error('Assignment requires an authenticated coordinator account.');
    }
    const coordinatorUid = auth.currentUser.uid;
    const normalizedReason = reason.trim();
    const requestRef = doc(db, 'requests', requestId);
    const coordinatorRef = doc(db, 'users', coordinatorUid);
    const auditRef = doc(collection(db, 'requests', requestId, 'assignmentHistory'));
    const notificationRef = doc(
      db,
      'notifications',
      notificationDocumentId(auditRef.id, providerUid)
    );
    const statusEventId = doc(collection(db, 'requests', requestId, 'statusHistory')).id;
    const assignmentTimestamp = serverTimestamp();
    let assignedProviderName = '';

    await runTransaction(db, async (transaction) => {
      const requestSnapshot = await transaction.get(requestRef);
      const coordinatorSnapshot = await transaction.get(coordinatorRef);
      const requestData = requestSnapshot.data();
      if (!requestSnapshot.exists() || !requestData) {
        throw new Error('This resource request no longer exists. Refresh and try again.');
      }
      if (
        !coordinatorSnapshot.exists() ||
        coordinatorSnapshot.data().role !== 'admin' ||
        coordinatorSnapshot.data().isActive !== true
      ) {
        throw new Error('Only an active, authenticated coordinator can assign resource requests.');
      }

      const providerRef = doc(db, 'providerDirectory', providerUid);
      const providerUserRef = doc(db, 'users', providerUid);
      const [providerSnapshot, providerUserSnapshot, auditSnapshot] = await Promise.all([
        transaction.get(providerRef),
        transaction.get(providerUserRef),
        transaction.get(auditRef)
      ]);
      if (auditSnapshot.exists()) {
        throw new Error('Could not create a unique assignment audit record. Please retry.');
      }
      if (!providerSnapshot.exists() || !providerUserSnapshot.exists()) {
        throw new Error('The selected provider account or directory entry no longer exists.');
      }

      const roleByResource: Record<ResourceRequest['resourceType'], UserRole> = {
        bed: 'hospital',
        icu: 'hospital',
        hospital_admission: 'hospital',
        blood: 'bloodBank',
        oxygen: 'oxygenProvider',
        ambulance: 'ambulanceProvider',
        doctor: 'doctor',
        doctor_assistance: 'doctor'
      };
      const provider = providerSnapshot.data();
      const providerUser = providerUserSnapshot.data();
      const requiredRole = roleByResource[requestData.resourceType as ResourceRequest['resourceType']];
      if (!requiredRole) throw new Error('This request has an unsupported resource type.');
      if (
        provider.uid !== providerUid ||
        provider.role !== requiredRole ||
        provider.isActive !== true ||
        provider.isVerified !== true ||
        providerUser.role !== requiredRole ||
        providerUser.isActive !== true ||
        providerUser.isVerified !== true
      ) {
        throw new Error('The selected provider is no longer active, verified, or eligible for this resource.');
      }
      if (providerUid === coordinatorUid) {
        throw new Error('A coordinator cannot assign a request to their own account.');
      }

      const previousProviderUid = requestData.providerUid || '';
      const previousProviderName = requestData.providerName || '';
      if (previousProviderUid === providerUid) {
        throw new Error('This request is already assigned to the selected provider.');
      }
      if (previousProviderUid && normalizedReason.length < 5) {
        throw new Error('Enter a reassignment reason of at least five characters.');
      }

      const coordinator = coordinatorSnapshot.data();
      assignedProviderName = provider.displayName || providerUser.displayName || '';
      const previousStatus = String(requestData.status);
      const statusHistory = requestData.statusHistory && typeof requestData.statusHistory === 'object'
        ? requestData.statusHistory
        : {};
      transaction.set(auditRef, {
        requestId,
        caseId: requestData.caseId,
        resourceType: requestData.resourceType,
        previousProviderUid,
        previousProviderName,
        newProviderUid: providerUid,
        newProviderName: assignedProviderName,
        coordinatorUid,
        coordinatorName: coordinator.displayName || '',
        timestamp: assignmentTimestamp,
        reason: normalizedReason || 'Initial assignment'
      });
      transaction.update(requestRef, {
        providerUid,
        providerName: provider.displayName || providerUser.displayName || '',
        status: 'ASSIGNED',
        assignedAt: assignmentTimestamp,
        assignmentCoordinatorUid: coordinatorUid,
        lastAssignmentAuditId: auditRef.id,
        updatedAt: assignmentTimestamp,
        respondedByUid: deleteField(),
        respondedAt: deleteField(),
        responseDetails: deleteField(),
        rejectionReason: deleteField(),
        ...(previousStatus !== 'ASSIGNED' ? {
          lastStatusEventId: statusEventId,
          statusHistory: {
            ...statusHistory,
            [statusEventId]: {
              eventId: statusEventId,
              eventType: 'request_status',
              previousStatus,
              newStatus: 'ASSIGNED',
              updatedByUid: coordinatorUid,
              userRole: 'admin',
              timestamp: assignmentTimestamp,
              requestId,
              resourceType: requestData.resourceType
            }
          }
        } : {})
      });
      transaction.set(notificationRef, {
        recipientUid: providerUid,
        type: 'request_assigned',
        eventType: 'request_assignment',
        eventId: auditRef.id,
        title: previousProviderUid ? 'Resource request reassigned' : 'New resource request assigned',
        message: `Emergency ${requestData.caseId}: ${requestData.resourceType} request assigned to you${previousProviderUid ? ` after reassignment: ${normalizedReason}` : '.'}`,
        details: previousProviderUid ? normalizedReason : 'A coordinator assigned this emergency resource request to you.',
        emergencyId: requestData.caseId,
        relatedCaseId: requestData.caseId,
        relatedRequestId: requestId,
        resourceType: requestData.resourceType,
        resourceDetails: requestData.details || {},
        actorUid: coordinatorUid,
        isRead: false,
        createdAt: assignmentTimestamp
      });
    });

    const localRequest = this.state.requests.find((request) => request.requestId === requestId);
    if (localRequest) {
      localRequest.providerUid = providerUid;
      localRequest.providerName = assignedProviderName;
      localRequest.status = 'ASSIGNED';
      localRequest.assignedAt = new Date().toISOString();
      localRequest.assignmentCoordinatorUid = coordinatorUid;
      this.saveState();
    }
  }

  public async transitionEmergencyCaseStatus(
    caseId: string,
    nextStatus: EmergencyLifecycleStatus,
    reason?: string
  ): Promise<void> {
    if (!isFirebaseConfigured || !db || !auth.currentUser) {
      throw new Error('Emergency lifecycle updates require an authenticated coordinator account.');
    }

    const coordinatorUid = auth.currentUser.uid;
    const normalizedReason = reason?.trim() || '';
    if ((nextStatus === 'REJECTED' || nextStatus === 'CANCELLED') && normalizedReason.length < 5) {
      throw new Error('A reason of at least five characters is required for rejection or cancellation.');
    }

    const caseRef = doc(db, 'cases', caseId);
    const coordinatorRef = doc(db, 'users', coordinatorUid);
    const caseEventId = doc(collection(db, 'cases', caseId, 'statusHistory')).id;
    const transitionTimestamp = serverTimestamp();
    const requestDocuments = nextStatus === 'REJECTED' || nextStatus === 'CANCELLED'
      ? (await getDocs(query(collection(db, 'requests'), where('caseId', '==', caseId)))).docs
      : [];

    await runTransaction(db, async (transaction) => {
      const [caseSnapshot, coordinatorSnapshot] = await Promise.all([
        transaction.get(caseRef),
        transaction.get(coordinatorRef)
      ]);
      const requestSnapshots = await Promise.all(
        requestDocuments.map((requestDocument) => transaction.get(requestDocument.ref))
      );
      if (!caseSnapshot.exists()) {
        throw new Error('This emergency case no longer exists. Refresh and try again.');
      }
      const coordinator = coordinatorSnapshot.data();
      if (!coordinatorSnapshot.exists() || coordinator?.role !== 'admin' || coordinator?.isActive !== true) {
        throw new Error('Only an active, authenticated coordinator can update the emergency lifecycle.');
      }

      const emergencyCase = caseSnapshot.data();
      const patientUid = emergencyCase.patientUid;
      if (typeof patientUid !== 'string' || !patientUid) {
        throw new Error('This emergency case has no valid patient account.');
      }
      const previousStatus = String(emergencyCase.status || '');
      if (!getAllowedEmergencyCaseTransitions(previousStatus).includes(nextStatus)) {
        throw new Error(`The emergency cannot transition from ${previousStatus || 'unknown'} to ${nextStatus}.`);
      }

      const caseEvent = {
        eventId: caseEventId,
        eventType: 'case_status',
        previousStatus,
        newStatus: nextStatus,
        updatedByUid: coordinatorUid,
        userRole: coordinator.role,
        timestamp: transitionTimestamp,
        ...(normalizedReason ? { reason: normalizedReason } : {})
      };
      transaction.update(caseRef, {
        status: nextStatus,
        updatedAt: transitionTimestamp,
        lastLifecycleEventId: caseEventId,
        [`lifecycleHistory.${caseEventId}`]: caseEvent,
        rejectionReason: nextStatus === 'REJECTED' ? normalizedReason : deleteField(),
        cancellationReason: nextStatus === 'CANCELLED' ? normalizedReason : deleteField()
      });
      requestSnapshots.forEach((requestSnapshot) => {
        if (!requestSnapshot.exists()) return;
        const request = requestSnapshot.data();
        const requestStatus = String(request.status || '');
        if (['COMPLETED', 'REJECTED', 'CANCELLED', 'completed', 'rejected', 'cancelled'].includes(requestStatus)) return;
        const requestEventId = doc(collection(db, 'requests', requestSnapshot.id, 'statusHistory')).id;
        const requestEvent = {
          eventId: requestEventId,
          eventType: 'request_status',
          previousStatus: requestStatus,
          newStatus: nextStatus,
          updatedByUid: coordinatorUid,
          userRole: coordinator.role,
          timestamp: transitionTimestamp,
          reason: normalizedReason,
          requestId: requestSnapshot.id,
          resourceType: request.resourceType
        };
        transaction.update(requestSnapshot.ref, {
          status: nextStatus,
          updatedAt: transitionTimestamp,
          lastStatusEventId: requestEventId,
          [`statusHistory.${requestEventId}`]: requestEvent,
          rejectionReason: nextStatus === 'REJECTED' ? normalizedReason : deleteField(),
          cancellationReason: nextStatus === 'CANCELLED' ? normalizedReason : deleteField()
        });
      });
    });
  }

  public async getEmergencyTimelineFromFirestore(caseId: string): Promise<EmergencyLifecycleEvent[]> {
    if (!isFirebaseConfigured || !db || !auth.currentUser) {
      throw new Error('Emergency timeline requires an authenticated coordinator account.');
    }
    const caseSnapshot = await getDoc(doc(db, 'cases', caseId));
    if (!caseSnapshot.exists()) throw new Error('This emergency case no longer exists.');
    const caseData = caseSnapshot.data();
    const events = Object.values(normalizeLifecycleHistory(caseData.lifecycleHistory) || {});
    (Array.isArray(caseData.auditHistory) ? caseData.auditHistory : []).forEach((legacyAudit) => {
      if (!legacyAudit || typeof legacyAudit !== 'object') return;
      const audit = legacyAudit as Record<string, unknown>;
      if (typeof audit.timestamp !== 'string') return;
      events.push({
        eventId: String(audit.id || `legacy-${audit.timestamp}`),
        eventType: 'case_status',
        previousStatus: 'Unknown',
        newStatus: String(audit.status || 'Status updated'),
        updatedByUid: String(audit.updatedByUid || ''),
        userRole: String(audit.role || 'unknown'),
        timestamp: audit.timestamp,
        ...(typeof audit.reason === 'string' ? { reason: audit.reason } : {})
      });
    });
    const requestSnapshot = await getDocs(
      query(collection(db, 'requests'), where('caseId', '==', caseId))
    );

    for (const requestDocument of requestSnapshot.docs) {
      const request = requestDocument.data();
      events.push(...Object.values(normalizeLifecycleHistory(request.statusHistory) || {}));
      const assignmentSnapshot = await getDocs(
        collection(db, 'requests', requestDocument.id, 'assignmentHistory')
      );
      assignmentSnapshot.docs.forEach((auditDocument) => {
        const audit = auditDocument.data();
        events.push({
          eventId: auditDocument.id,
          eventType: 'assignment',
          previousStatus: String(request.status || 'REQUESTED'),
          newStatus: String(request.status || 'REQUESTED'),
          updatedByUid: audit.coordinatorUid || '',
          userRole: 'admin',
          timestamp: firestoreDateToIso(audit.timestamp),
          reason: audit.reason,
          requestId: requestDocument.id,
          resourceType: request.resourceType,
          previousProviderUid: audit.previousProviderUid || '',
          newProviderUid: audit.newProviderUid || '',
          previousProviderName: audit.previousProviderName || '',
          newProviderName: audit.newProviderName || ''
        });
      });
    }
    return events.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  }

  public subscribeToEmergencyHistory(
    patientUid: string,
    onCases: (cases: EmergencyCase[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      onError('Emergency history requires a configured Firebase project.');
      return () => undefined;
    }

    const casesByPatient = new Map<string, Map<string, EmergencyCase>>();
    const requestsByPatient = new Map<string, Map<string, ResourceRequest[]>>();
    const caseSubscriptions = new Map<string, Unsubscribe>();
    const requestSubscriptions = new Map<string, Unsubscribe>();
    const loadedCasePatients = new Set<string>();
    const loadedRequestPatients = new Set<string>();
    let activeLinksLoaded = false;
    const emitCases = () => {
      if (!activeLinksLoaded || [...caseSubscriptions.keys()].some((uid) =>
        !loadedCasePatients.has(uid) || !loadedRequestPatients.has(uid)
      )) return;
      const cases = [...casesByPatient.values()]
        .flatMap((patientCases) => [...patientCases.values()])
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      onCases(cases);
    };
    const applyRequestsToCases = (linkedPatientUid: string) => {
      const requestGroups = requestsByPatient.get(linkedPatientUid) || new Map<string, ResourceRequest[]>();
      casesByPatient.get(linkedPatientUid)?.forEach((caseRecord) => {
        caseRecord.resourceRequests = requestGroups.get(caseRecord.caseId) || [];
      });
    };
    const subscribeToPatientCases = (linkedPatientUid: string) => {
      if (caseSubscriptions.has(linkedPatientUid)) return;
      const patientCases = new Map<string, EmergencyCase>();
      casesByPatient.set(linkedPatientUid, patientCases);
      const casesQuery = query(collection(db, 'cases'), where('patientUid', '==', linkedPatientUid));
      const unsubscribe = onSnapshot(casesQuery, (snapshot) => {
        try {
          patientCases.clear();
          snapshot.docs.forEach((caseSnapshot) => {
            const caseRecord = normalizeEmergencyCase(caseSnapshot.data(), caseSnapshot.id);
            patientCases.set(caseRecord.caseId, caseRecord);
          });
          applyRequestsToCases(linkedPatientUid);
          loadedCasePatients.add(linkedPatientUid);
          emitCases();
        } catch (error) {
          onError(error instanceof Error ? error.message : 'An emergency record could not be read.');
        }
      }, (error) => {
        onError(`Could not load emergency history: ${error.message}`);
      });
      caseSubscriptions.set(linkedPatientUid, unsubscribe);

      const patientRequests = new Map<string, ResourceRequest[]>();
      requestsByPatient.set(linkedPatientUid, patientRequests);
      const requestsQuery = query(collection(db, 'requests'), where('patientUid', '==', linkedPatientUid));
      const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
        try {
          patientRequests.clear();
          snapshot.docs.forEach((requestSnapshot) => {
            const requestRecord = normalizeResourceRequest(requestSnapshot.data(), requestSnapshot.id);
            const caseRequests = patientRequests.get(requestRecord.caseId) || [];
            caseRequests.push(requestRecord);
            patientRequests.set(requestRecord.caseId, caseRequests);
          });
          applyRequestsToCases(linkedPatientUid);
          loadedRequestPatients.add(linkedPatientUid);
          emitCases();
        } catch (error) {
          onError(error instanceof Error ? error.message : 'A resource request status could not be read.');
        }
      }, (error) => {
        onError(`Could not load emergency resource statuses: ${error.message}`);
      });
      requestSubscriptions.set(linkedPatientUid, unsubscribeRequests);
    };

    subscribeToPatientCases(patientUid);
    const linksQuery = query(
      collectionGroup(db, 'attendants'),
      where('attendantUid', '==', patientUid),
      where('activeConsent', '==', true)
    );
    const unsubscribeLinks = onSnapshot(linksQuery, (snapshot) => {
      const linkedPatientUids = new Set(
        snapshot.docs
          .map((linkSnapshot) => linkSnapshot.data().patientUid)
          .filter((linkedPatientUid): linkedPatientUid is string =>
            typeof linkedPatientUid === 'string' && linkedPatientUid !== patientUid
          )
      );
      activeLinksLoaded = true;

      caseSubscriptions.forEach((unsubscribe, linkedPatientUid) => {
        if (linkedPatientUid !== patientUid && !linkedPatientUids.has(linkedPatientUid)) {
          unsubscribe();
          requestSubscriptions.get(linkedPatientUid)?.();
          requestSubscriptions.delete(linkedPatientUid);
          caseSubscriptions.delete(linkedPatientUid);
          casesByPatient.delete(linkedPatientUid);
          requestsByPatient.delete(linkedPatientUid);
          loadedCasePatients.delete(linkedPatientUid);
          loadedRequestPatients.delete(linkedPatientUid);
        }
      });
      linkedPatientUids.forEach(subscribeToPatientCases);
      emitCases();
    }, (error) => {
      onError(`Could not load linked-patient history: ${error.message}`);
    });

    return () => {
      unsubscribeLinks();
      caseSubscriptions.forEach((unsubscribe) => unsubscribe());
      requestSubscriptions.forEach((unsubscribe) => unsubscribe());
      caseSubscriptions.clear();
      requestSubscriptions.clear();
      casesByPatient.clear();
      requestsByPatient.clear();
    };
  }

  public subscribeToPatientAttendants(
    patientUid: string,
    onLinks: (links: PatientAttendantLink[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      onError('Attendant consent management requires a configured Firebase project.');
      return () => undefined;
    }

    return onSnapshot(collection(db, 'users', patientUid, 'attendants'), (snapshot) => {
      onLinks(snapshot.docs.map((linkSnapshot) => {
        const data = linkSnapshot.data();
        return {
          attendantUid: data.attendantUid || linkSnapshot.id,
          activeConsent: data.activeConsent === true,
          updatedAt: firestoreDateToIso(data.updatedAt)
        };
      }));
    }, (error) => {
      onError(`Could not load attendant consent settings: ${error.message}`);
    });
  }

  public async setPatientAttendantConsent(
    patientUid: string,
    attendantUid: string,
    activeConsent: boolean
  ): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Attendant consent management requires a configured Firebase project.');
    }
    if (!auth.currentUser || auth.currentUser.uid !== patientUid) {
      throw new Error('Only the signed-in patient can manage attendant consent.');
    }
    if (!attendantUid.trim() || attendantUid === patientUid) {
      throw new Error('Enter a different patient’s registered CareBridge account UID.');
    }

    const linkRef = doc(db, 'users', patientUid, 'attendants', attendantUid);
    const existingLink = await getDoc(linkRef);
    if (!activeConsent && !existingLink.exists()) {
      throw new Error('There is no active attendant link to revoke.');
    }

    await setDoc(linkRef, {
      patientUid,
      attendantUid,
      activeConsent,
      ...(activeConsent ? { grantedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  public createCase(newCase: EmergencyCase) {
    // Check if case already exists in local list
    const existingIdx = this.state.cases.findIndex((c) => c.caseId === newCase.caseId);
    if (existingIdx >= 0) {
      this.state.cases[existingIdx] = { ...newCase, updatedAt: new Date().toISOString() };
    } else {
      this.state.cases.unshift(newCase);
    }
    this.saveState();
  }

  public async createEmergencySubmission(
    emergencyCase: EmergencyCase,
    requestDrafts: ResourceRequestDraft[],
    city: string
  ): Promise<{ requests: ResourceRequest[]; hospitalName: string; alreadySubmitted: boolean }> {
    if (!isFirebaseConfigured || !db || !auth.currentUser) {
      throw new Error('Emergency submissions require an authenticated Firebase account. No data was saved.');
    }

    const requesterUid = auth.currentUser.uid;
    const requesterSnapshot = await getDoc(doc(db, 'users', requesterUid));
    const patientSnapshot = await getDoc(doc(db, 'users', emergencyCase.patientUid));
    if (!requesterSnapshot.exists() || !patientSnapshot.exists()) {
      throw new Error('The requester or patient account could not be verified. No data was saved.');
    }

    const requester = requesterSnapshot.data();
    const patient = patientSnapshot.data();
    if (
      requester.isActive !== true ||
      patient.role !== 'patient' ||
      patient.isActive !== true ||
      (emergencyCase.requesterUid && emergencyCase.requesterUid !== requesterUid)
    ) {
      throw new Error('The requester is not authorized to submit this emergency case.');
    }

    const isSelfSubmission = requesterUid === emergencyCase.patientUid && requester.role === 'patient';
    if (!isSelfSubmission) {
      const linkId = `${requesterUid}_${emergencyCase.patientUid}`;
      const patientLinkSnapshot = await getDoc(doc(db, 'patientLinks', linkId));
      const nestedLinkSnapshot = await getDoc(doc(db, 'users', emergencyCase.patientUid, 'attendants', requesterUid));
      const hasPatientLink = patientLinkSnapshot.exists() &&
        patientLinkSnapshot.data().attendantUid === requesterUid &&
        patientLinkSnapshot.data().patientUid === emergencyCase.patientUid &&
        patientLinkSnapshot.data().consentGranted === true &&
        patientLinkSnapshot.data().consentStatus === 'granted';
      const hasNestedLink = nestedLinkSnapshot.exists() &&
        nestedLinkSnapshot.data().attendantUid === requesterUid &&
        nestedLinkSnapshot.data().patientUid === emergencyCase.patientUid &&
        nestedLinkSnapshot.data().activeConsent === true;
      if (!ATTENDANT_ROLES.includes(requester.role) || (!hasPatientLink && !hasNestedLink)) {
        throw new Error('Active patient consent is required before an attendant can submit an emergency case.');
      }
    }

    const caseRef = doc(db, 'cases', emergencyCase.caseId);
    const existingCaseSnapshot = await getDoc(caseRef);
    if (existingCaseSnapshot.exists()) {
      const existingCase = existingCaseSnapshot.data() as EmergencyCase;
      if (
        existingCase.patientUid !== emergencyCase.patientUid ||
        existingCase.requesterUid !== requesterUid ||
        existingCase.submissionFingerprint !== emergencyCase.submissionFingerprint
      ) {
        throw new Error('This emergency submission ID is already in use. Start a new case to submit different details.');
      }

      const existingRequests = await Promise.all(requestDrafts.map(async (draft) => {
        const requestId = `REQ-${emergencyCase.caseId}-${draft.resourceType}`;
        const requestSnapshot = await getDoc(doc(db, 'requests', requestId));
        if (!requestSnapshot.exists()) {
          throw new Error('This case was saved but its linked requests could not be verified. Please contact support.');
        }

        const requestData = requestSnapshot.data();
        const expectedDetails = draft.resourceType === 'ambulance'
          ? { ...draft.details, destinationAddress: existingCase.matchedHospitalName }
          : draft.details;
        const storedDetails = requestData.details;
        const detailsMatch = storedDetails &&
          Object.keys(expectedDetails).length === Object.keys(storedDetails).length &&
          Object.entries(expectedDetails).every(([key, value]) => storedDetails[key] === value);
        if (
          requestData.requestId !== requestId ||
          requestData.caseId !== emergencyCase.caseId ||
          requestData.patientUid !== emergencyCase.patientUid ||
          requestData.requesterUid !== requesterUid ||
          requestData.resourceType !== draft.resourceType ||
          typeof requestData.providerUid !== 'string' ||
          typeof requestData.providerName !== 'string' ||
          !['pending', 'REQUESTED', 'ASSIGNED', 'accepted', 'ACCEPTED', 'rejected', 'REJECTED', 'cancelled', 'CANCELLED', 'completed', 'COMPLETED'].includes(requestData.status) ||
          !detailsMatch
        ) {
          throw new Error('Saved request details do not match this case. Please contact support.');
        }

        return {
          ...requestData,
          createdAt: firestoreDateToIso(requestData.createdAt),
          updatedAt: firestoreDateToIso(requestData.updatedAt)
        } as ResourceRequest;
      }));
      const hospitalName = existingCase.matchedHospitalName;
      if (!hospitalName) {
        throw new Error('This case was saved but its matched hospital could not be verified. Please contact support.');
      }

      this.createCase({ ...emergencyCase, matchedHospitalName: hospitalName, requestCount: 0 });
      existingRequests.forEach((request) => this.createRequest(request));
      return { requests: existingRequests, hospitalName, alreadySubmitted: true };
    }

    const directorySnapshot = await getDocs(collection(db, 'providerDirectory'));
    const providers = directorySnapshot.docs
      .map((snapshot) => ({
        ...snapshot.data(),
        directoryUid: snapshot.id
      }) as ProviderDirectoryEntry & { directoryUid: string })
      .filter((provider) =>
        provider.uid === provider.directoryUid &&
        provider.displayName &&
        PROVIDER_ROLES.includes(provider.role) &&
        provider.isActive &&
        provider.isVerified
      );
    const normalizedCity = city.trim().toLocaleLowerCase();
    const byRole = (role: UserRole) =>
      providers
        .filter((provider) => provider.role === role)
        .sort((a, b) => {
          const aMatchesCity = (a.city || '').trim().toLocaleLowerCase() === normalizedCity;
          const bMatchesCity = (b.city || '').trim().toLocaleLowerCase() === normalizedCity;
          return Number(bMatchesCity) - Number(aMatchesCity) || a.uid.localeCompare(b.uid);
        });

    const hospitalProvider = byRole('hospital')[0];
    if (!hospitalProvider) {
      throw new Error('No active, verified hospital is available in the provider directory. No data was saved.');
    }

    const now = new Date().toISOString();
    const requests = requestDrafts.map((draft) => {
      const candidates = byRole(draft.providerRole);
      const provider = draft.providerRole === 'doctor'
        ? candidates.find((candidate) =>
            candidate.hospitalAffiliation?.trim().toLocaleLowerCase() ===
            hospitalProvider.displayName.trim().toLocaleLowerCase()
          )
        : candidates[0];
      if (!provider) {
        const label = draft.providerRole === 'doctor'
          ? 'doctor affiliated with the matched hospital'
          : draft.providerRole;
        throw new Error(`No active, verified ${label} is available. No data was saved.`);
      }

      const requestId = `REQ-${emergencyCase.caseId}-${draft.resourceType}`;
      return {
        ref: doc(db, 'requests', requestId),
        request: {
          requestId,
          caseId: emergencyCase.caseId,
          patientUid: emergencyCase.patientUid,
          requesterUid,
          patientName: emergencyCase.patientName,
          providerUid: provider.uid,
          providerName: provider.displayName,
          resourceType: draft.resourceType,
          details: draft.resourceType === 'ambulance'
            ? { ...draft.details, destinationAddress: hospitalProvider.displayName }
            : draft.details,
          status: 'REQUESTED' as const,
          createdAt: now,
          updatedAt: now
        }
      };
    });

    const batch = writeBatch(db);
    batch.set(caseRef, {
      ...emergencyCase,
      status: 'REQUESTED',
      requesterUid,
      requesterRole: requester.role,
      attendantUid: isSelfSubmission ? emergencyCase.attendantUid : requesterUid,
      matchedHospitalName: hospitalProvider.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    requests.forEach(({ ref, request }) => {
      batch.set(ref, {
        ...request,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();

    const savedCase = {
      ...emergencyCase,
      status: 'REQUESTED' as const,
      requesterUid,
      requesterRole: requester.role,
      attendantUid: isSelfSubmission ? emergencyCase.attendantUid : requesterUid,
      matchedHospitalName: hospitalProvider.displayName,
      requestCount: 0
    };
    this.createCase(savedCase);
    requests.forEach(({ request }) => this.createRequest(request));

    return {
      requests: requests.map(({ request }) => request),
      hospitalName: hospitalProvider.displayName,
      alreadySubmitted: false
    };
  }

  public updateCaseStatus(
    caseId: string,
    status: CaseStatus,
    updater?: { uid: string; name: string; role: string; note?: string; reason?: string }
  ) {
    const item = this.state.cases.find((c) => c.caseId === caseId);
    if (item) {
      item.status = status;
      item.updatedAt = new Date().toISOString();
      if (updater?.reason) {
        if (status === 'REJECTED') item.rejectionReason = updater.reason;
        if (status === 'cancelled') item.cancellationReason = updater.reason;
      }

      if (!item.auditHistory) item.auditHistory = [];
      item.auditHistory.push({
        id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        status,
        updatedByUid: updater?.uid || 'system',
        updatedByName: updater?.name || 'CareBridge Coordinator',
        role: updater?.role || 'admin',
        timestamp: new Date().toISOString(),
        note: updater?.note,
        reason: updater?.reason
      });

      if (status === 'cancelled' || status === 'REJECTED') {
        // Automatically cancel any pending requests
        this.state.requests
          .filter((r) => r.caseId === caseId && (r.status === 'pending' || r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW'))
          .forEach((r) => {
            r.status = 'cancelled';
            r.updatedAt = new Date().toISOString();
          });
      }

      // Notify patient and attendant of emergency status progress
      const recipients = Array.from(new Set([item.patientUid, item.attendantUid, item.attendant?.uid].filter(Boolean))) as string[];
      recipients.forEach((recipUid) => {
        this.addNotification({
          id: 'notif-' + Date.now() + '-' + recipUid.slice(-4),
          recipientUid: recipUid,
          type: 'system_alert',
          title: `Emergency ${item.caseId} Status: ${String(status).replace('_', ' ')}`,
          message: `Case condition status updated to "${String(status).replace('_', ' ')}"${updater?.note ? ` - ${updater.note}` : ''}.`,
          relatedCaseId: item.caseId,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      });

      this.saveState();
    }
  }

  // --- Resource Requests ---
  public getRequests(): ResourceRequest[] {
    return [...this.state.requests];
  }

  public getRequestsForCase(caseId: string): ResourceRequest[] {
    return this.state.requests.filter((r) => r.caseId === caseId);
  }

  public getRequestsForProvider(providerUid: string): ResourceRequest[] {
    return this.state.requests.filter((r) => r.providerUid === providerUid);
  }

  public replaceRequestsForProvider(providerUid: string, requests: ResourceRequest[]) {
    const requestIds = new Set(requests.map((request) => request.requestId));
    this.state.requests = [
      ...requests,
      ...this.state.requests.filter((request) =>
        request.providerUid !== providerUid && !requestIds.has(request.requestId)
      )
    ];
    this.saveState();
  }

  public createRequest(req: ResourceRequest) {
    const isNewRequest = !this.state.requests.some((request) => request.requestId === req.requestId);
    this.state.requests = this.state.requests.filter((request) => request.requestId !== req.requestId);
    this.state.requests.unshift(req);
    // Increment case request count
    const parentCase = this.state.cases.find((c) => c.caseId === req.caseId);
    if (parentCase && isNewRequest) {
      parentCase.requestCount = (parentCase.requestCount || 0) + 1;
      parentCase.updatedAt = new Date().toISOString();
    }

    // Notify Provider
    if (isNewRequest) this.state.notifications.unshift({
      id: 'notif-' + Date.now(),
      recipientUid: req.providerUid,
      type: 'request_received',
      title: `Emergency ${req.resourceType.toUpperCase()} Request`,
      message: `Incoming request for case ${req.caseId} (${req.patientName || 'Patient'}).`,
      relatedCaseId: req.caseId,
      relatedRequestId: req.requestId,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    this.saveState();
  }

  public respondToRequest(requestId: string, status: 'accepted' | 'rejected' | 'completed', reason?: string) {
    const req = this.state.requests.find((r) => r.requestId === requestId);
    if (!req) return;

    req.status = status;
    req.respondedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();
    if (reason) req.rejectionReason = reason;

    // Side effect 1: If hospital accepts admission, decrement available bed
    if (status === 'accepted' && req.resourceType === 'bed') {
      const hosp = this.state.hospitalProfiles[req.providerUid];
      if (hosp) {
        if (req.details.bedType?.toLowerCase().includes('icu')) {
          hosp.availableICU = Math.max(0, hosp.availableICU - 1);
        } else {
          hosp.availableBeds = Math.max(0, hosp.availableBeds - 1);
        }
        hosp.lastUpdated = new Date().toISOString();
      }
    }

    // Side effect 2: If blood bank accepts, decrement inventory
    if (status === 'accepted' && req.resourceType === 'blood' && req.details.bloodGroup) {
      const bb = this.state.bloodBankProfiles[req.providerUid];
      const bg = req.details.bloodGroup as keyof typeof bb.inventory;
      if (bb && bb.inventory[bg]) {
        const units = req.details.units || 1;
        bb.inventory[bg] = Math.max(0, bb.inventory[bg] - units);
        bb.lastUpdated = new Date().toISOString();
      }
    }

    // Side effect 3: If oxygen provider accepts, decrement cylinder count
    if (status === 'accepted' && req.resourceType === 'oxygen') {
      const oxy = this.state.oxygenProfiles[req.providerUid];
      if (oxy) {
        const cyl = req.details.cylinders || 1;
        oxy.cylindersAvailable = Math.max(0, oxy.cylindersAvailable - cyl);
        oxy.lastUpdated = new Date().toISOString();
      }
    }

    // Side effect 4: If ambulance provider accepts, create/activate AmbulanceTrip!
    if (status === 'accepted' && req.resourceType === 'ambulance') {
      const amb = this.state.ambulanceProfiles[req.providerUid];
      const availableVehicle = amb?.vehicles.find((v) => v.isAvailable) || amb?.vehicles[0];

      if (availableVehicle) {
        availableVehicle.isAvailable = false;
        availableVehicle.currentStatus = 'on_trip';
      }

      const newTrip: AmbulanceTrip = {
        tripId: 'TRIP-' + Date.now().toString().slice(-6),
        requestId: req.requestId,
        caseId: req.caseId,
        patientUid: req.patientUid,
        providerUid: req.providerUid,
        vehicleId: availableVehicle?.vehicleId || 'KA-25-EM-1081',
        vehicleType: availableVehicle?.vehicleType || 'ALS Ambulance',
        driverName: availableVehicle?.driverName || 'Ramesh Patil',
        driverPhone: availableVehicle?.driverPhone || '+91 98452 11081',
        pickupLocation: {
          address: req.details.pickupAddress || 'Patient Incident Location',
          city: 'Hubballi'
        },
        destinationLocation: {
          address: req.details.destinationAddress || 'Assigned Hospital Emergency Wing',
          city: 'Hubballi'
        },
        status: 'dispatched',
        statusHistory: [
          { status: 'dispatched', timestamp: new Date().toISOString(), note: 'Trip dispatched by ambulance provider' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.state.trips.unshift(newTrip);
    }

    // Check if parent case needs lifecycle advancement
    const parentCase = this.state.cases.find((c) => c.caseId === req.caseId);
    if (parentCase) {
      if (status === 'accepted') {
        const caseReqs = this.state.requests.filter((r) => r.caseId === req.caseId);
        const allAccepted = caseReqs.length > 0 && caseReqs.every((r) => r.status === 'accepted');
        parentCase.status = allAccepted ? 'RESOURCE_CONFIRMED' : 'ACCEPTED';
        parentCase.updatedAt = new Date().toISOString();

        if (!parentCase.auditHistory) parentCase.auditHistory = [];
        parentCase.auditHistory.push({
          id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          status: parentCase.status,
          updatedByUid: req.providerUid,
          updatedByName: req.providerName,
          role: req.resourceType,
          timestamp: new Date().toISOString(),
          note: `${req.providerName} accepted ${req.resourceType.toUpperCase()} request.`
        });
      } else if (status === 'rejected') {
        if (!parentCase.auditHistory) parentCase.auditHistory = [];
        parentCase.auditHistory.push({
          id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          status: 'UNDER_REVIEW',
          updatedByUid: req.providerUid,
          updatedByName: req.providerName,
          role: req.resourceType,
          timestamp: new Date().toISOString(),
          note: `${req.providerName} declined ${req.resourceType.toUpperCase()} request.`,
          reason
        });
      }
    }

    // Notify Patient & Attendant
    const patientAndAttendant = Array.from(new Set([
      req.patientUid,
      parentCase?.attendantUid,
      parentCase?.attendant?.uid
    ].filter(Boolean))) as string[];

    patientAndAttendant.forEach((recip) => {
      this.addNotification({
        id: 'notif-' + Date.now() + '-' + recip.slice(-4),
        recipientUid: recip,
        type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
        title: `${req.providerName} ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
        message:
          status === 'accepted'
            ? `Your ${req.resourceType.toUpperCase()} request has been accepted by ${req.providerName}.`
            : `Your request was declined: ${reason || 'Capacity exceeded'}. Coordinator will reassign suitable provider.`,
        relatedCaseId: req.caseId,
        relatedRequestId: req.requestId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    // Notify Central Coordinators / Admins about the response
    const admins = this.state.users.filter((u) => u.role === 'admin');
    admins.forEach((adminUser) => {
      this.addNotification({
        id: 'notif-' + Date.now() + '-' + adminUser.uid.slice(-4),
        recipientUid: adminUser.uid,
        type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
        title: `Provider ${status === 'accepted' ? 'Accepted' : 'REJECTED'}: ${req.providerName}`,
        message:
          status === 'accepted'
            ? `${req.providerName} accepted ${req.resourceType} for case ${req.caseId}.`
            : `ACTION NEEDED: ${req.providerName} rejected ${req.resourceType} for case ${req.caseId} (Reason: ${reason || 'Capacity full'}). Please reassign.`,
        relatedCaseId: req.caseId,
        relatedRequestId: req.requestId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    this.saveState();
  }

  public cancelRequest(requestId: string) {
    const req = this.state.requests.find((r) => r.requestId === requestId);
    if (req && req.status === 'pending') {
      req.status = 'cancelled';
      req.updatedAt = new Date().toISOString();

      this.addNotification({
        id: 'notif-' + Date.now(),
        recipientUid: req.providerUid,
        type: 'request_cancelled',
        title: 'Request Cancelled',
        message: `Patient cancelled ${req.resourceType} request for case ${req.caseId}.`,
        relatedCaseId: req.caseId,
        relatedRequestId: req.requestId,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      this.saveState();
    }
  }

  // --- Ambulance Trips ---
  public getTrips(): AmbulanceTrip[] {
    return [...this.state.trips];
  }

  public getTripForRequest(requestId: string): AmbulanceTrip | undefined {
    return this.state.trips.find((t) => t.requestId === requestId);
  }

  public getTripForCase(caseId: string): AmbulanceTrip | undefined {
    return this.state.trips.find((t) => t.caseId === caseId);
  }

  public updateTripStatus(tripId: string, status: AmbulanceTripStatus, note?: string) {
    const trip = this.state.trips.find((t) => t.tripId === tripId);
    if (!trip) return;

    trip.status = status;
    trip.updatedAt = new Date().toISOString();
    trip.statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      note: note || `Ambulance transitioned to ${status.replace('_', ' ')}`
    });

    if (status === 'completed') {
      // Free up vehicle
      const amb = this.state.ambulanceProfiles[trip.providerUid];
      const vehicle = amb?.vehicles.find((v) => v.vehicleId === trip.vehicleId);
      if (vehicle) {
        vehicle.isAvailable = true;
        vehicle.currentStatus = 'idle';
      }
    }

    // Synchronize parent emergency case lifecycle status
    const parentCase = this.state.cases.find((c) => c.caseId === trip.caseId);
    if (parentCase) {
      if (status === 'dispatched') {
        parentCase.status = 'DISPATCHED';
      } else if (status === 'picked_up' || status === 'in_transit') {
        parentCase.status = 'IN_PROGRESS';
      } else if (status === 'delivered' || status === 'completed') {
        // If hospital is confirmed, keep as in-progress or completed
        if (status === 'completed') parentCase.status = 'COMPLETED';
      }
      parentCase.updatedAt = new Date().toISOString();
      if (!parentCase.auditHistory) parentCase.auditHistory = [];
      parentCase.auditHistory.push({
        id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        status: parentCase.status,
        updatedByUid: trip.providerUid,
        updatedByName: 'Ambulance Unit ' + trip.vehicleId,
        role: 'ambulanceProvider',
        timestamp: new Date().toISOString(),
        note: `Ambulance trip updated to ${status.replace('_', ' ').toUpperCase()}`
      });
    }

    // Notify Patient
    this.addNotification({
      id: 'notif-' + Date.now(),
      recipientUid: trip.patientUid,
      type: 'ambulance_updated',
      title: `Ambulance: ${status.toUpperCase().replace('_', ' ')}`,
      message: `Ambulance (${trip.vehicleId}) status updated: ${note || status.replace('_', ' ')}.`,
      relatedCaseId: trip.caseId,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    this.saveState();
  }

  // --- Notifications ---
  public getNotifications(recipientUid: string): NotificationItem[] {
    return this.state.notifications
      .filter((n) => n.recipientUid === recipientUid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addNotification(notif: NotificationItem) {
    this.state.notifications.unshift(notif);
    this.saveState();
  }

  public markNotificationAsRead(id: string) {
    const n = this.state.notifications.find((item) => item.id === id);
    if (n) {
      n.isRead = true;
      this.saveState();
    }
  }

  public markAllNotificationsAsRead(recipientUid: string) {
    this.state.notifications
      .filter((n) => n.recipientUid === recipientUid)
      .forEach((n) => (n.isRead = true));
    this.saveState();
  }

  // --- Clinical Notes (Doctor Role) ---
  public getClinicalNotes(caseId: string): ClinicalNote[] {
    return this.state.clinicalNotes.filter((n) => n.caseId === caseId);
  }

  public addClinicalNote(note: ClinicalNote) {
    this.state.clinicalNotes.unshift(note);
    this.saveState();
  }
}

// Global Singleton Instance
export const dataStore = new DataStore();

// ==========================================
// ASYNC FIRESTORE SYNC & PERSISTENCE HELPERS
// ==========================================

export async function fetchPatientLinksFromFirestore(attendantUid: string): Promise<PatientLink[]> {
  if (!isFirebaseConfigured || !db) {
    return dataStore.getPatientLinks(attendantUid);
  }
  try {
    const q = query(collection(db, 'patientLinks'), where('attendantUid', '==', attendantUid));
    const snap = await getDocs(q);
    const links: PatientLink[] = [];
    snap.forEach((d) => {
      links.push(d.data() as PatientLink);
    });
    // Sync to local store
    links.forEach((l) => dataStore.savePatientLink(l));
    return links;
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to fetch patient links:', err);
    return dataStore.getPatientLinks(attendantUid);
  }
}

export async function savePatientLinkToFirestore(link: PatientLink): Promise<void> {
  dataStore.savePatientLink(link);
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'patientLinks', link.id), link);
    } catch (err) {
      console.warn('[CareBridge Firestore] Failed to save patient link:', err);
    }
  }
}

export async function deletePatientLinkFromFirestore(linkId: string): Promise<void> {
  dataStore.deletePatientLink(linkId);
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'patientLinks', linkId));
    } catch (err) {
      console.warn('[CareBridge Firestore] Failed to delete patient link:', err);
    }
  }
}

/**
 * Real-time Firestore listener for attendant's linked patients
 * Updates instantly via onSnapshot when patient links change in Firestore
 */
export function subscribePatientLinksFromFirestore(
  attendantUid: string,
  onUpdate: (links: PatientLink[]) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    const initial = dataStore.getPatientLinks(attendantUid);
    onUpdate(initial);
    return dataStore.subscribe(() => {
      onUpdate(dataStore.getPatientLinks(attendantUid));
    });
  }
  try {
    const q = query(collection(db, 'patientLinks'), where('attendantUid', '==', attendantUid));
    return onSnapshot(
      q,
      (snapshot) => {
        const links: PatientLink[] = [];
        snapshot.forEach((doc) => {
          links.push(doc.data() as PatientLink);
        });
        links.forEach((l) => dataStore.savePatientLink(l));
        onUpdate(links);
      },
      (error) => {
        console.warn('[CareBridge Firestore] onSnapshot error on patientLinks:', error);
        onUpdate(dataStore.getPatientLinks(attendantUid));
      }
    );
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to subscribe to patientLinks:', err);
    onUpdate(dataStore.getPatientLinks(attendantUid));
    return () => {};
  }
}

/**
 * Real-time Firestore listener for attendant's emergency cases
 * Listens for live dispatch status updates on cases owned by this attendant
 */
export function subscribeCasesForAttendantFromFirestore(
  attendantUid: string,
  linkedPatientUids: string[] = [],
  onUpdate: (cases: EmergencyCase[]) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    const initial = dataStore.getCasesForAttendant(attendantUid, linkedPatientUids);
    onUpdate(initial);
    return dataStore.subscribe(() => {
      onUpdate(dataStore.getCasesForAttendant(attendantUid, linkedPatientUids));
    });
  }
  try {
    const q = query(collection(db, 'cases'), where('attendantUid', '==', attendantUid));
    return onSnapshot(
      q,
      (snapshot) => {
        const cases: EmergencyCase[] = [];
        snapshot.forEach((doc) => {
          cases.push(doc.data() as EmergencyCase);
        });
        cases.forEach((c) => dataStore.createCase(c));
        const combined = Array.from(
          new Map([...dataStore.getCasesForAttendant(attendantUid, linkedPatientUids), ...cases].map((c) => [c.caseId, c])).values()
        );
        onUpdate(combined);
      },
      (error) => {
        console.warn('[CareBridge Firestore] onSnapshot error on cases:', error);
        onUpdate(dataStore.getCasesForAttendant(attendantUid, linkedPatientUids));
      }
    );
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to subscribe to cases:', err);
    onUpdate(dataStore.getCasesForAttendant(attendantUid, linkedPatientUids));
    return () => {};
  }
}

export async function fetchCasesForAttendantFromFirestore(
  attendantUid: string,
  linkedPatientUids: string[] = []
): Promise<EmergencyCase[]> {
  if (!isFirebaseConfigured || !db) {
    return dataStore.getCasesForAttendant(attendantUid, linkedPatientUids);
  }
  try {
    const casesMap = new Map<string, EmergencyCase>();

    // 1. Cases where user is the attendant
    try {
      const q1 = query(collection(db, 'cases'), where('attendantUid', '==', attendantUid));
      const snap1 = await getDocs(q1);
      snap1.forEach((d) => {
        const c = d.data() as EmergencyCase;
        casesMap.set(c.caseId, c);
      });
    } catch (e) {
      console.warn('[CareBridge Firestore] Query by attendantUid note:', e);
    }

    // 2. Cases where user is the patient directly (self-created cases or patient account)
    try {
      const qSelf = query(collection(db, 'cases'), where('patientUid', '==', attendantUid));
      const snapSelf = await getDocs(qSelf);
      snapSelf.forEach((d) => {
        const c = d.data() as EmergencyCase;
        casesMap.set(c.caseId, c);
      });
    } catch (e) {
      console.warn('[CareBridge Firestore] Query by patientUid self note:', e);
    }

    // 3. Cases for linked patient UIDs (attendant accessing authorized patients)
    for (const pUid of linkedPatientUids) {
      try {
        const qP = query(collection(db, 'cases'), where('patientUid', '==', pUid));
        const snapP = await getDocs(qP);
        snapP.forEach((d) => {
          const c = d.data() as EmergencyCase;
          casesMap.set(c.caseId, c);
        });
      } catch (e) {
        console.warn('[CareBridge Firestore] Query by patientUid note:', e);
      }
    }

    const results = Array.from(casesMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    // sync to local store
    results.forEach((c) => dataStore.createCase(c));
    return results;
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to fetch cases for attendant:', err);
    return dataStore.getCasesForAttendant(attendantUid, linkedPatientUids);
  }
}

export interface CaseValidationResult {
  isValid: boolean;
  valid: boolean;
  errors: Record<string, string>;
  errorList: string[];
}

export function validateEmergencyCasePayload(
  payload: Partial<EmergencyCase>,
  requester: { uid: string; role: string },
  linkedPatients: PatientLink[] = []
): CaseValidationResult {
  const errors: Record<string, string> = {};

  // 1. Patient Information
  if (!payload.patientName || !payload.patientName.trim()) {
    errors.patientName = 'Patient full name is required.';
  }
  const patientUid = payload.patientUid || payload.patientId;
  if (!patientUid || !patientUid.trim()) {
    errors.patientUid = 'Patient ID is required.';
  }
  const age = Number(payload.patientAge);
  if (payload.patientAge === undefined || payload.patientAge === null || isNaN(age) || age <= 0 || age > 130) {
    errors.patientAge = 'Please enter a valid patient age (1–130).';
  }
  if (!payload.patientGender || !payload.patientGender.trim()) {
    errors.patientGender = 'Patient gender is required.';
  }

  // 2. Authorization and Consent
  const isSelf = requester.role === 'patient' || requester.uid === patientUid;
  if (!isSelf) {
    const link = linkedPatients.find((l) => l.patientUid === patientUid);
    if (!link) {
      errors.authorization = 'Unauthorized: You are not authorized to create emergency cases for unrelated patients.';
    } else if (!link.consentGranted || link.consentStatus !== 'granted') {
      errors.consent = 'Valid, active patient consent is required before creating an emergency case on behalf of this patient.';
    }
  }

  // 3. Emergency Details
  const category = payload.category || payload.emergencyCategory;
  if (!category || !category.trim()) {
    errors.category = 'Please select an emergency category.';
  }
  const condition = payload.conditionSummary || payload.patientCondition || payload.emergencyDescription;
  if (!condition || !condition.trim()) {
    errors.conditionSummary = 'Emergency condition description is required.';
  }
  const priority = payload.priority || payload.emergencyPriority || payload.triagePriority;
  if (!priority) {
    errors.priority = 'Please select an emergency priority level.';
  }

  // 4. Required Services
  const services = payload.requiredServices || payload.resourcesNeeded || [];
  if (!services || services.length === 0) {
    errors.services = 'Please select at least one emergency service (Hospital admission, Blood, Oxygen, Ambulance, or Doctor assistance).';
  }

  const hasBlood = services.some((s) => s.toLowerCase().includes('blood')) || Boolean(payload.quotas?.bloodRequired);
  if (hasBlood) {
    const bloodGroup = payload.quotas?.bloodGroup || payload.patientBloodGroup;
    const bloodUnits = Number(payload.quotas?.bloodUnits ?? payload.quotas?.bloodUnitsRequested);
    if (!bloodGroup || bloodGroup === 'Unknown' || !bloodGroup.trim()) {
      errors.bloodGroup = 'Blood group must be specified when blood requirement is selected.';
    }
    if (!bloodUnits || isNaN(bloodUnits) || bloodUnits <= 0) {
      errors.bloodUnits = 'Number of blood units required must be at least 1.';
    }
  }

  const hasOxygen = services.some((s) => s.toLowerCase().includes('oxygen')) || Boolean(payload.quotas?.oxygenRequired);
  if (hasOxygen) {
    const oxyType = payload.quotas?.oxygenType;
    const oxyQty = Number(payload.quotas?.oxygenQuantity ?? payload.quotas?.oxygenCylindersRequested);
    if (!oxyType) {
      errors.oxygenType = 'Oxygen supply type (cylinder, concentrator, or both) must be specified.';
    }
    if (!oxyQty || isNaN(oxyQty) || oxyQty <= 0) {
      errors.oxygenQuantity = 'Oxygen supply quantity must be at least 1.';
    }
  }

  // 5. Location
  const address = payload.location?.address || payload.incidentAddress;
  if (!address || !address.trim()) {
    errors.location = 'Current emergency location address / landmark is required.';
  }

  // 6. Contact Information
  const contactPerson = payload.contactPerson || payload.attendant?.name || payload.attendantName || payload.patientName;
  const contactPhone = payload.contactPhone || payload.attendant?.phone || payload.attendantPhone || payload.patientPhone;
  if (!contactPerson || !contactPerson.trim()) {
    errors.contactPerson = 'Contact person name is required.';
  }
  if (!contactPhone || !contactPhone.trim() || contactPhone.trim().length < 8) {
    errors.contactPhone = 'Please enter a valid emergency contact phone number.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    valid: isValid,
    errors,
    errorList: Object.values(errors)
  };
}

export async function createEmergencyCase(
  caseRecord: EmergencyCase,
  requester: { uid: string; role: string },
  linkedPatients: PatientLink[] = []
): Promise<{ success: boolean; caseId: string; error?: string }> {
  // 1. Enforce validation before writing
  const validation = validateEmergencyCasePayload(caseRecord, requester, linkedPatients);
  if (!validation.isValid) {
    const firstErr = validation.errorList[0] || 'Emergency case validation failed';
    return { success: false, caseId: caseRecord.caseId, error: firstErr };
  }

  // 2. Prevent duplicate submissions / idempotency
  const existing = dataStore.getCase(caseRecord.caseId);
  if (existing) {
    return { success: true, caseId: caseRecord.caseId };
  }

  const submittedCase = { ...caseRecord, status: 'REQUESTED' as const };
  dataStore.createCase(submittedCase);

  // 4. Save to Firestore if configured
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'cases', caseRecord.caseId), submittedCase);
    } catch (err: any) {
      console.warn('[CareBridge Firestore] Failed to write case to Firestore:', err);
      throw err;
    }
  }

  return { success: true, caseId: caseRecord.caseId };
}

export async function saveCaseToFirestore(emergencyCase: EmergencyCase): Promise<void> {
  const submittedCase = { ...emergencyCase, status: 'REQUESTED' as const };
  dataStore.createCase(submittedCase);
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'cases', emergencyCase.caseId), submittedCase);
    } catch (err) {
      console.warn('[CareBridge Firestore] Failed to write case to Firestore:', err);
    }
  }
}

export async function fetchRequestsForCasesFromFirestore(caseIds: string[]): Promise<ResourceRequest[]> {
  if (caseIds.length === 0) return [];
  if (!isFirebaseConfigured || !db) {
    return dataStore.getRequests().filter((r) => caseIds.includes(r.caseId));
  }
  try {
    const reqs: ResourceRequest[] = [];
    for (const cId of caseIds) {
      const q = query(collection(db, 'requests'), where('caseId', '==', cId));
      const snap = await getDocs(q);
      snap.forEach((d) => reqs.push(d.data() as ResourceRequest));
    }
    return reqs;
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to fetch requests for cases:', err);
    return dataStore.getRequests().filter((r) => caseIds.includes(r.caseId));
  }
}

export function subscribeRequestsForProviderFromFirestore(
  providerUid: string,
  onUpdate: (requests: ResourceRequest[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db || !auth.currentUser || auth.currentUser.uid !== providerUid) {
    onError('Sign in with the assigned provider account to load resource requests from Firestore.');
    return () => undefined;
  }

  try {
    return onSnapshot(
      query(collection(db, 'requests'), where('providerUid', '==', providerUid)),
      (snapshot) => {
        try {
          const requests = snapshot.docs.map((requestSnapshot) => {
            return normalizeResourceRequest(requestSnapshot.data(), requestSnapshot.id);
          });
          requests.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
          onUpdate(requests);
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Assigned resource requests contain invalid data.');
        }
      },
      (error) => {
        onError(`Could not load assigned resource requests: ${error.message}`);
      }
    );
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Could not subscribe to assigned resource requests.');
    return () => undefined;
  }
}

export async function getAssignedCaseForProviderFromFirestore(caseId: string): Promise<EmergencyCase | null> {
  if (!isFirebaseConfigured || !db || !auth.currentUser) {
    throw new Error('Assigned patient details require an authenticated Firebase provider account.');
  }
  const caseSnapshot = await getDoc(doc(db, 'cases', caseId));
  if (!caseSnapshot.exists()) return null;
  return normalizeEmergencyCase(caseSnapshot.data(), caseSnapshot.id);
}

export async function respondToRequestInFirestore(
  requestId: string,
  status: 'accepted' | 'rejected',
  reason?: string
): Promise<boolean> {
  if (!isFirebaseConfigured || !db || !auth.currentUser) {
    throw new Error('Provider responses require an authenticated Firebase account.');
  }
  const providerUid = auth.currentUser.uid;
  const normalizedReason = reason?.trim() || '';
  if (status === 'rejected' && normalizedReason.length < 5) {
    throw new Error('A rejection reason of at least five characters is required.');
  }

  const requestRef = doc(db, 'requests', requestId);
  const statusEventId = doc(collection(db, 'requests', requestId, 'statusHistory')).id;
  const providerRef = doc(db, 'users', providerUid);
  const providerDirectoryRef = doc(db, 'providerDirectory', providerUid);
  const responseTimestamp = serverTimestamp();

  return runTransaction(db, async (transaction) => {
    const [requestSnapshot, providerSnapshot, directorySnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(providerRef),
      transaction.get(providerDirectoryRef)
    ]);
    if (!requestSnapshot.exists()) {
      throw new Error('This resource request is no longer available.');
    }

    const request = requestSnapshot.data();
    const provider = providerSnapshot.data();
    const directory = directorySnapshot.data();
    if (request.providerUid !== providerUid) {
      throw new Error('Only the currently assigned provider can respond to this request.');
    }
    if (!providerSnapshot.exists() || !directorySnapshot.exists() ||
      provider?.isActive !== true || provider?.isVerified !== true ||
      directory?.isActive !== true || directory?.isVerified !== true ||
      directory?.uid !== providerUid || directory?.role !== provider?.role) {
      throw new Error('Only active, verified providers can respond to assigned requests.');
    }
    const roleByResource: Record<ResourceRequest['resourceType'], UserRole> = {
      bed: 'hospital',
      icu: 'hospital',
      hospital_admission: 'hospital',
      blood: 'bloodBank',
      oxygen: 'oxygenProvider',
      ambulance: 'ambulanceProvider',
      doctor: 'doctor',
      doctor_assistance: 'doctor'
    };
    if (roleByResource[request.resourceType as ResourceRequest['resourceType']] !== provider.role) {
      throw new Error('This provider is not eligible to respond to the resource type.');
    }
    if (!['pending', 'assigned', 'requested', 'ASSIGNED', 'REQUESTED'].includes(String(request.status))) {
      throw new Error('This request has already received a response or is no longer actionable.');
    }

    const previousStatus = String(request.status);
    const nextStatus: EmergencyLifecycleStatus = status === 'accepted' ? 'ACCEPTED' : 'REJECTED';
    const responseDetails = status === 'accepted' ? 'Accepted by provider.' : normalizedReason;
    const statusEvent = {
      eventId: statusEventId,
      eventType: 'request_status',
      previousStatus,
      newStatus: nextStatus,
      updatedByUid: providerUid,
      userRole: provider.role,
      timestamp: responseTimestamp,
      ...(status === 'rejected' ? { reason: normalizedReason } : {}),
      requestId,
      resourceType: request.resourceType
    };
    const coordinatorUid = typeof request.assignmentCoordinatorUid === 'string'
      ? request.assignmentCoordinatorUid
      : '';
    if (!coordinatorUid) {
      throw new Error('This assigned request has no coordinator to notify.');
    }
    const notificationRef = doc(
      db,
      'notifications',
      notificationDocumentId(statusEventId, coordinatorUid)
    );
    const providerName = directory.displayName || provider.displayName || providerUid;
    transaction.update(requestRef, {
      status: nextStatus,
      respondedByUid: providerUid,
      responseDetails,
      ...(status === 'rejected' ? { rejectionReason: normalizedReason } : {}),
      respondedAt: responseTimestamp,
      updatedAt: responseTimestamp,
      lastStatusEventId: statusEventId,
      [`statusHistory.${statusEventId}`]: statusEvent
    });
    transaction.set(notificationRef, {
      recipientUid: coordinatorUid,
      type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
      eventType: 'provider_response',
      eventId: statusEventId,
      title: `Resource request ${status}`,
      message: status === 'accepted'
        ? `Emergency ${request.caseId}: ${providerName} accepted the ${request.resourceType} request.`
        : `Emergency ${request.caseId}: ${providerName} rejected the ${request.resourceType} request: ${normalizedReason}`,
      details: responseDetails,
      emergencyId: request.caseId,
      relatedCaseId: request.caseId,
      relatedRequestId: requestId,
      resourceType: request.resourceType,
      resourceDetails: request.details || {},
      actorUid: providerUid,
      responseProviderUid: providerUid,
      isRead: false,
      createdAt: responseTimestamp
    });
    return true;
  });
}

export function subscribeNotificationsForUserFromFirestore(
  recipientUid: string,
  onUpdate: (notifications: NotificationItem[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    onUpdate(dataStore.getNotifications(recipientUid));
    return dataStore.subscribe(() => onUpdate(dataStore.getNotifications(recipientUid)));
  }
  if (!auth.currentUser || auth.currentUser.uid !== recipientUid) {
    onError('Sign in to load notifications for this account.');
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, 'notifications'), where('recipientUid', '==', recipientUid)),
    (snapshot) => {
      try {
        const notifications = snapshot.docs.map((notificationSnapshot) => {
          const data = notificationSnapshot.data();
          return {
            ...data,
            id: notificationSnapshot.id,
            createdAt: firestoreDateToIso(data.createdAt)
          } as NotificationItem;
        });
        notifications.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        onUpdate(notifications);
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Notification data is invalid.');
      }
    },
    (error) => onError(`Could not load notifications: ${error.message}`)
  );
}

export async function markNotificationReadInFirestore(notificationId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    dataStore.markNotificationAsRead(notificationId);
    return;
  }
  if (!auth.currentUser) throw new Error('Sign in to update notifications.');
  await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
}

export async function markAllNotificationsReadInFirestore(recipientUid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    dataStore.markAllNotificationsAsRead(recipientUid);
    return;
  }
  if (!auth.currentUser || auth.currentUser.uid !== recipientUid) {
    throw new Error('Sign in to update notifications for this account.');
  }
  const unread = await getDocs(query(
    collection(db, 'notifications'),
    where('recipientUid', '==', recipientUid),
    where('isRead', '==', false)
  ));
  for (let offset = 0; offset < unread.docs.length; offset += 500) {
    const batch = writeBatch(db);
    unread.docs.slice(offset, offset + 500).forEach((notificationSnapshot) => {
      batch.update(notificationSnapshot.ref, { isRead: true });
    });
    await batch.commit();
  }
}
