import type {
  Clinic,
  ClinicStatus,
  GeoLocation,
  OperatingHours,
  ClinicService,
  ClinicStaff,
  ClinicStaffRole,
} from './clinics.types.js';
import { omitUndefined } from '../../shared/types/object.utils.js';

export interface CreateClinicDto {
  name: string;
  ownerId: string;
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  division?: string;
  location?: GeoLocation;
  services?: string[];
}

export interface UpdateClinicDto {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  division?: string;
  location?: GeoLocation;
  services?: string[];
  status?: ClinicStatus;
  operatingHours?: OperatingHours[];
}

export interface CreateClinicServiceDto {
  clinicId: string;
  name: string;
  description?: string;
  price?: number;
  duration?: number;
}

export interface AddStaffDto {
  clinicId: string;
  userId: string;
  role: ClinicStaffRole;
}

export interface ClinicResponseDto {
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
  createdAt: string;
}

export interface ClinicServiceResponseDto {
  id: string;
  clinicId: string;
  name: string;
  description?: string;
  price?: number;
  duration?: number;
  isActive: boolean;
}

export interface ClinicStaffResponseDto {
  id: string;
  clinicId: string;
  userId: string;
  role: ClinicStaffRole;
  joinedAt: string;
}

export function toClinicResponseDto(clinic: Clinic): ClinicResponseDto {
  return omitUndefined({
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    ownerId: clinic.ownerId,
    status: clinic.status,
    phone: clinic.phone,
    email: clinic.email,
    address: clinic.address,
    district: clinic.district,
    division: clinic.division,
    location: clinic.location,
    services: clinic.services,
    operatingHours: clinic.operatingHours,
    rating: clinic.rating,
    totalReviews: clinic.totalReviews,
    createdAt: clinic.createdAt.toISOString(),
  });
}

export function toClinicServiceResponseDto(service: ClinicService): ClinicServiceResponseDto {
  return omitUndefined({
    id: service.id,
    clinicId: service.clinicId,
    name: service.name,
    description: service.description,
    price: service.price,
    duration: service.duration,
    isActive: service.isActive,
  });
}

export function toClinicStaffResponseDto(staff: ClinicStaff): ClinicStaffResponseDto {
  return {
    id: staff.id,
    clinicId: staff.clinicId,
    userId: staff.userId,
    role: staff.role,
    joinedAt: staff.joinedAt.toISOString(),
  };
}
