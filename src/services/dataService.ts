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
  onSnapshot,
  query,
  where,
  serverTimestamp,
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
  AmbulanceTripStatus
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

// ==========================================
// SEEDED DEMO DATASET
// ==========================================

export const DEMO_USERS: UserProfile[] = [
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
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
      clinicalNotes: []
    };
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
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

  // --- Emergency Cases ---
  public getCases(): EmergencyCase[] {
    return [...this.state.cases];
  }

  public getCasesForPatient(patientUid: string): EmergencyCase[] {
    return this.state.cases.filter((c) => c.patientUid === patientUid);
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
        onCases(snapshot.docs.map((caseSnapshot) => {
          const data = caseSnapshot.data();
          return {
            ...data,
            caseId: data.caseId || caseSnapshot.id,
            createdAt: firestoreDateToIso(data.createdAt),
            updatedAt: firestoreDateToIso(data.updatedAt ?? data.createdAt)
          } as EmergencyCase;
        }));
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Emergency cases could not be read.');
      }
    }, (error) => {
      onError(`Could not load emergency cases: ${error.message}`);
    });

    const unsubscribeRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      try {
        onRequests(snapshot.docs.map((requestSnapshot) => {
          const data = requestSnapshot.data();
          return {
            ...data,
            requestId: data.requestId || requestSnapshot.id,
            createdAt: firestoreDateToIso(data.createdAt),
            updatedAt: data.updatedAt ? firestoreDateToIso(data.updatedAt) : ''
          } as ResourceRequest;
        }));
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
    const caseSubscriptions = new Map<string, Unsubscribe>();
    const loadedPatientUids = new Set<string>();
    let activeLinksLoaded = false;
    const emitCases = () => {
      if (!activeLinksLoaded || [...caseSubscriptions.keys()].some((uid) => !loadedPatientUids.has(uid))) return;
      const cases = [...casesByPatient.values()]
        .flatMap((patientCases) => [...patientCases.values()])
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      onCases(cases);
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
            const data = caseSnapshot.data();
            const caseRecord = {
              ...data,
              caseId: data.caseId || caseSnapshot.id,
              createdAt: firestoreDateToIso(data.createdAt),
              updatedAt: firestoreDateToIso(data.updatedAt)
            } as EmergencyCase;
            patientCases.set(caseRecord.caseId, caseRecord);
          });
          loadedPatientUids.add(linkedPatientUid);
          emitCases();
        } catch (error) {
          onError(error instanceof Error ? error.message : 'An emergency record could not be read.');
        }
      }, (error) => {
        onError(`Could not load emergency history: ${error.message}`);
      });
      caseSubscriptions.set(linkedPatientUid, unsubscribe);
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
          caseSubscriptions.delete(linkedPatientUid);
          casesByPatient.delete(linkedPatientUid);
          loadedPatientUids.delete(linkedPatientUid);
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
      caseSubscriptions.clear();
      casesByPatient.clear();
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
    this.state.cases = this.state.cases.filter((item) => item.caseId !== newCase.caseId);
    this.state.cases.unshift(newCase);
    this.saveState();
  }

  public async createEmergencySubmission(
    emergencyCase: EmergencyCase,
    requestDrafts: ResourceRequestDraft[],
    city: string
  ): Promise<{ requests: ResourceRequest[]; hospitalName: string; alreadySubmitted: boolean }> {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Emergency submissions require a configured Firebase project. No data was saved.');
    }
    if (!auth.currentUser || auth.currentUser.uid !== emergencyCase.patientUid) {
      throw new Error('The signed-in patient does not match this emergency case. No data was saved.');
    }

    const patientSnapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!patientSnapshot.exists() || patientSnapshot.data().role !== 'patient') {
      throw new Error('Only an authorized patient account can submit an emergency case.');
    }

    const caseRef = doc(db, 'cases', emergencyCase.caseId);
    const existingCaseSnapshot = await getDoc(caseRef);
    if (existingCaseSnapshot.exists()) {
      const existingCase = existingCaseSnapshot.data() as EmergencyCase;
      if (
        existingCase.patientUid !== auth.currentUser.uid ||
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
          requestData.patientUid !== auth.currentUser?.uid ||
          requestData.requesterUid !== auth.currentUser?.uid ||
          requestData.resourceType !== draft.resourceType ||
          typeof requestData.providerUid !== 'string' ||
          typeof requestData.providerName !== 'string' ||
          !['pending', 'accepted', 'rejected', 'cancelled', 'completed'].includes(requestData.status) ||
          !detailsMatch
        ) {
          throw new Error('Saved request details do not match this case. Please contact support.');
        }

        const toIsoString = (value: unknown) => {
          if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
          if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
            const date = value.toDate() as Date;
            if (!Number.isNaN(date.getTime())) return date.toISOString();
          }
          throw new Error('Saved request timestamps could not be verified. Please contact support.');
        };

        return {
          ...requestData,
          createdAt: toIsoString(requestData.createdAt),
          updatedAt: toIsoString(requestData.updatedAt)
        } as ResourceRequest;
      }));
      const hospitalName = existingCase.matchedHospitalName;
      if (!hospitalName) {
        throw new Error('This case was saved but its matched hospital could not be verified. Please contact support.');
      }

      this.createCase({ ...emergencyCase, matchedHospitalName: hospitalName, requestCount: 0 });
      existingRequests.forEach((request) => this.createRequest(request));
      const localCase = this.getCase(emergencyCase.caseId);
      if (localCase) {
        localCase.requestCount = existingRequests.length;
        this.saveState();
      }

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
        ? candidates.find(
            (candidate) =>
              candidate.hospitalAffiliation?.trim().toLocaleLowerCase() ===
              hospitalProvider.displayName.trim().toLocaleLowerCase()
          )
        : candidates[0];

      if (!provider) {
        const roleLabel = draft.providerRole === 'doctor' ? 'doctor affiliated with the matched hospital' : draft.providerRole;
        throw new Error(`No active, verified ${roleLabel} is available. No data was saved.`);
      }

      const requestId = `REQ-${emergencyCase.caseId}-${draft.resourceType}`;
      const requestRef = doc(db, 'requests', requestId);
      return {
        ref: requestRef,
        request: {
          requestId,
          caseId: emergencyCase.caseId,
          patientUid: emergencyCase.patientUid,
          requesterUid: emergencyCase.patientUid,
          patientName: emergencyCase.patientName,
          providerUid: provider.uid,
          providerName: provider.displayName,
          resourceType: draft.resourceType,
          details: draft.resourceType === 'ambulance'
            ? { ...draft.details, destinationAddress: hospitalProvider.displayName }
            : draft.details,
          status: 'pending' as const,
          createdAt: now,
          updatedAt: now
        }
      };
    });

    const batch = writeBatch(db);
    batch.set(caseRef, {
      ...emergencyCase,
      matchedHospitalName: hospitalProvider.displayName,
      attendantConsent: emergencyCase.attendantConsent
        ? { ...emergencyCase.attendantConsent, grantedAt: serverTimestamp() }
        : null,
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

    this.createCase({
      ...emergencyCase,
      matchedHospitalName: hospitalProvider.displayName,
      requestCount: 0
    });
    requests.forEach(({ request }) => this.createRequest(request));

    return {
      requests: requests.map(({ request }) => request),
      hospitalName: hospitalProvider.displayName,
      alreadySubmitted: false
    };
  }

  public updateCaseStatus(caseId: string, status: 'active' | 'resolved' | 'cancelled') {
    const item = this.state.cases.find((c) => c.caseId === caseId);
    if (item) {
      item.status = status;
      item.updatedAt = new Date().toISOString();

      if (status === 'cancelled') {
        // Automatically cancel any pending requests
        this.state.requests
          .filter((r) => r.caseId === caseId && r.status === 'pending')
          .forEach((r) => {
            r.status = 'cancelled';
            r.updatedAt = new Date().toISOString();
          });
      }

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

    // Notify Patient
    this.addNotification({
      id: 'notif-' + Date.now(),
      recipientUid: req.patientUid,
      type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
      title: `${req.providerName} ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
      message:
        status === 'accepted'
          ? `Your ${req.resourceType.toUpperCase()} request has been accepted by ${req.providerName}.`
          : `Your request was declined: ${reason || 'Capacity exceeded'}. You can request other providers.`,
      relatedCaseId: req.caseId,
      relatedRequestId: req.requestId,
      isRead: false,
      createdAt: new Date().toISOString()
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
