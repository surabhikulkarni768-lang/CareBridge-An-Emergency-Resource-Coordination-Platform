/**
 * CareBridge Domain Types
 * Matches the Firestore Data Model defined in carebridge_master_plan.md
 */

export type UserRole =
  | 'patient'
  | 'hospital'
  | 'bloodBank'
  | 'oxygenProvider'
  | 'ambulanceProvider'
  | 'doctor'
  | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  city: string;
  state: string;
  address?: string;
  isVerified: boolean;
  isActive: boolean;
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
  hospitalAffiliation?: string; // For doctor role
}

export type UrgencyLevel = 'immediate' | 'emergency' | 'urgent' | 'semi-urgent';
export type CaseStatus = 'active' | 'resolved' | 'cancelled';

export interface EmergencyCase {
  caseId: string; // e.g. CB-20261027-0042
  patientUid: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  conditionSummary: string;
  urgencyLevel: UrgencyLevel;
  resourcesNeeded: string[]; // ['bed', 'icu', 'blood', 'oxygen', 'ambulance']
  location: {
    city: string;
    address: string;
    state?: string;
  };
  attendant?: {
    name: string;
    relation: string;
    phone: string;
  };
  attendantConsent?: {
    granted: boolean;
    givenByUid: string;
    grantedAt: string;
  };
  submissionFingerprint?: string;
  matchedHospitalName?: string;
  status: CaseStatus;
  requestCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ResourceType = 'bed' | 'icu' | 'blood' | 'oxygen' | 'ambulance' | 'doctor';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';

export interface ResourceRequest {
  requestId: string; // REQ-YYYYMMDD-XXXX
  caseId: string;
  patientUid: string;
  requesterUid: string;
  patientName?: string;
  providerUid: string;
  providerName: string;
  resourceType: ResourceType;
  details: {
    bedType?: string;
    bloodGroup?: string;
    units?: number;
    cylinders?: number;
    concentrators?: number;
    vehicleType?: string;
    notes?: string;
    pickupAddress?: string;
    destinationAddress?: string;
  };
  status: RequestStatus;
  rejectionReason?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AmbulanceTripStatus =
  | 'dispatched'
  | 'en_route'
  | 'arrived'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'completed';

export interface TripStatusHistoryItem {
  status: AmbulanceTripStatus;
  timestamp: string;
  note?: string;
}

export interface AmbulanceTrip {
  tripId: string;
  requestId: string;
  caseId: string;
  patientUid: string;
  providerUid: string;
  vehicleId: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  pickupLocation: {
    address: string;
    city: string;
  };
  destinationLocation: {
    address: string;
    city: string;
  };
  status: AmbulanceTripStatus;
  statusHistory: TripStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface HospitalProfile {
  uid: string;
  hospitalName: string;
  registrationNumber: string;
  departments: string[];
  totalBeds: number;
  availableBeds: number;
  totalICU: number;
  availableICU: number;
  totalVentilators: number;
  availableVentilators: number;
  contactNumber: string;
  operatingHours: string;
  city: string;
  state: string;
  address: string;
  isVerified: boolean;
  lastUpdated: string;
}

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface BloodBankProfile {
  uid: string;
  bankName: string;
  licenseNumber: string;
  inventory: Record<BloodGroup, number>;
  contactNumber: string;
  city: string;
  state: string;
  address: string;
  isVerified: boolean;
  lastUpdated: string;
}

export interface OxygenProfile {
  uid: string;
  providerName: string;
  licenseNumber: string;
  cylindersAvailable: number;
  concentratorsAvailable: number;
  deliveryAvailable: boolean;
  contactNumber: string;
  city: string;
  state: string;
  address: string;
  isVerified: boolean;
  lastUpdated: string;
}

export interface AmbulanceVehicle {
  vehicleId: string;
  vehicleType: 'BLS' | 'ALS' | 'Patient Transport';
  driverName: string;
  driverPhone: string;
  isAvailable: boolean;
  currentStatus: 'idle' | 'on_trip';
}

export interface AmbulanceProfile {
  uid: string;
  providerName: string;
  licenseNumber: string;
  contactNumber: string;
  city: string;
  state: string;
  address: string;
  isVerified: boolean;
  vehicles: AmbulanceVehicle[];
  lastUpdated: string;
}

export interface NotificationItem {
  id: string;
  recipientUid: string;
  type:
    | 'request_received'
    | 'request_accepted'
    | 'request_rejected'
    | 'request_cancelled'
    | 'ambulance_dispatched'
    | 'ambulance_updated'
    | 'provider_verified'
    | 'system_alert';
  title: string;
  message: string;
  relatedCaseId?: string;
  relatedRequestId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ClinicalNote {
  id: string;
  caseId: string;
  doctorUid: string;
  doctorName: string;
  hospitalName: string;
  noteText: string;
  vitals?: {
    bp?: string;
    pulse?: string;
    spO2?: string;
    temp?: string;
  };
  createdAt: string;
}
