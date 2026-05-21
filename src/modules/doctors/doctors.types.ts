export interface Doctor {
  id: string;
  userId: string;
  clinicId?: string;
  specialization: DoctorSpecialization[];
  licenseNumber: string;
  yearsExperience: number;
  verificationStatus: DoctorVerificationStatus;
  rating?: number;
  totalConsultations: number;
  availabilityStatus: DoctorAvailability;
  bio?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DoctorSpecialization =
  | 'GENERAL'
  | 'CATTLE'
  | 'POULTRY'
  | 'PET'
  | 'AQUACULTURE'
  | 'EQUINE'
  | 'EXOTIC'
  | 'SURGERY'
  | 'EMERGENCY';

export type DoctorVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

export type DoctorAvailability =
  | 'ONLINE'
  | 'OFFLINE'
  | 'BUSY'
  | 'AWAY';

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface DoctorFilter {
  specialization?: DoctorSpecialization;
  verificationStatus?: DoctorVerificationStatus;
  availabilityStatus?: DoctorAvailability;
  clinicId?: string;
  search?: string;
  minRating?: number;
}
