/**
 * CareBridge Domain Types
 * Matches the Firestore Data Model defined in carebridge_master_plan.md
 */

export type UserRole =
  | 'patient'
  | 'patientAttendant'
  | 'patient_attendant'
  | 'attendant'
  | 'hospital'
  | 'bloodBank'
  | 'oxygenProvider'
  | 'ambulanceProvider'
  | 'doctor'
  | 'admin';

export interface PatientLink {
  id: string; // e.g. `${attendantUid}_${patientUid}` or generated UUID
  attendantUid: string;
  attendantName: string;
  attendantEmail?: string;
  patientUid: string;
  patientName: string;
  relationship: string; // e.g., 'Parent', 'Spouse', 'Child', 'Sibling', 'Relative', 'Ward', 'Other'
  patientAge: number;
  patientGender: string;
  patientBloodGroup?: string;
  emergencyContactPhone?: string;
  medicalNotes?: string;
  // Patient Consent Governance
  consentGranted: boolean;
  consentStatus: 'granted' | 'pending' | 'revoked';
  consentDate: string;
  consentType: 'explicit_patient_consent' | 'legal_guardian_consent' | 'emergency_proxy';
  createdAt: string;
  updatedAt: string;
}

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
export type EmergencyPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type EmergencyCategory =
  | 'Trauma / Accident'
  | 'Cardiac Emergency'
  | 'Respiratory Distress'
  | 'Stroke / Neurological'
  | 'Severe Bleeding / Hemorrhage'
  | 'Maternal / Obstetric'
  | 'Pediatric Emergency'
  | 'General Acute Medical';

export type CaseStatus =
  | 'active'
  | 'resolved'
  | 'cancelled'
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'RESOURCE_CONFIRMED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED';

export interface EmergencyAuditItem {
  id: string;
  status: CaseStatus;
  updatedByUid: string;
  updatedByName: string;
  role: string;
  timestamp: string;
  note?: string;
  reason?: string;
}

export interface ResourceQuotas {
  bedRequired?: boolean;
  icuRequired?: boolean;
  bloodRequired?: boolean;
  bloodGroup?: string;
  bloodUnits?: number;
  oxygenRequired?: boolean;
  oxygenType?: 'cylinder' | 'concentrator' | 'both';
  oxygenQuantity?: number;
  ambulanceRequired?: boolean;
  ambulanceType?: 'BLS' | 'ALS' | 'Patient Transport';
}

export interface EmergencyCase {
  caseId: string; // e.g. EMG-20261111-0042 or CB-20261027-0042
  patientUid: string;
  attendantUid?: string; // Associated attendant UID
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientBloodGroup?: string;
  category?: EmergencyCategory;
  conditionSummary: string;
  urgencyLevel: UrgencyLevel;
  priority?: EmergencyPriority;
  resourcesNeeded: string[]; // ['bed', 'icu', 'blood', 'oxygen', 'ambulance']
  quotas?: ResourceQuotas;
  location: {
    city: string;
    address: string;
    state?: string;
    landmark?: string;
  };
  contactPhone?: string;
  attendant?: {
    uid?: string;
    name: string;
    relation: string;
    phone: string;
  };
  status: CaseStatus;
  requestCount: number;
  assignedHospitalUid?: string;
  assignedHospitalName?: string;
  assignedBloodBankUid?: string;
  assignedBloodBankName?: string;
  assignedOxygenUid?: string;
  assignedOxygenName?: string;
  assignedAmbulanceUid?: string;
  assignedAmbulanceName?: string;
  estimatedResponseMinutes?: number;
  auditHistory?: EmergencyAuditItem[];
  rejectionReason?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type ResourceType = 'bed' | 'icu' | 'blood' | 'oxygen' | 'ambulance';
export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'RESOURCE_CONFIRMED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export interface ResourceRequest {
  requestId: string; // REQ-YYYYMMDD-XXXX
  caseId: string;
  patientUid: string;
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
    estimatedResponseTimeMinutes?: number;
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

