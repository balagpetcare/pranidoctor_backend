export interface Clinic {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: ClinicStatus;
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  division?: string;
  location?: GeoLocation;
  services: string[];
  operatingHours?: OperatingHours[];
  rating?: number;
  totalReviews: number;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ClinicStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface OperatingHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface ClinicService {
  id: string;
  clinicId: string;
  name: string;
  description?: string;
  price?: number;
  duration?: number;
  isActive: boolean;
}

export interface ClinicStaff {
  id: string;
  clinicId: string;
  userId: string;
  role: ClinicStaffRole;
  joinedAt: Date;
}

export type ClinicStaffRole = 'OWNER' | 'ADMIN' | 'DOCTOR' | 'TECHNICIAN' | 'RECEPTIONIST';

export interface ClinicFilter {
  status?: ClinicStatus;
  district?: string;
  division?: string;
  services?: string[];
  search?: string;
  nearLocation?: GeoLocation & { radiusKm: number };
}
