import type {
  Doctor,
  DoctorSpecialization,
  DoctorVerificationStatus,
  DoctorAvailability,
  DoctorSchedule,
} from './doctors.types.js';
import { omitUndefined } from '../../shared/types/object.utils.js';

export interface CreateDoctorDto {
  userId: string;
  clinicId?: string;
  specialization: DoctorSpecialization[];
  licenseNumber: string;
  yearsExperience: number;
  bio?: string;
}

export interface UpdateDoctorDto {
  specialization?: DoctorSpecialization[];
  bio?: string;
  availabilityStatus?: DoctorAvailability;
}

export interface VerifyDoctorDto {
  status: DoctorVerificationStatus;
  reason?: string;
}

export interface DoctorScheduleDto {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface DoctorResponseDto {
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
  createdAt: string;
}

export interface DoctorScheduleResponseDto {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export function toDoctorResponseDto(doctor: Doctor): DoctorResponseDto {
  return omitUndefined({
    id: doctor.id,
    userId: doctor.userId,
    clinicId: doctor.clinicId,
    specialization: doctor.specialization,
    licenseNumber: doctor.licenseNumber,
    yearsExperience: doctor.yearsExperience,
    verificationStatus: doctor.verificationStatus,
    rating: doctor.rating,
    totalConsultations: doctor.totalConsultations,
    availabilityStatus: doctor.availabilityStatus,
    bio: doctor.bio,
    createdAt: doctor.createdAt.toISOString(),
  });
}

export function toDoctorScheduleResponseDto(schedule: DoctorSchedule): DoctorScheduleResponseDto {
  return {
    id: schedule.id,
    doctorId: schedule.doctorId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    isActive: schedule.isActive,
  };
}
