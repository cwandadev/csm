// src/lib/api/attendance.ts

import api from '@/lib/api';

export interface CreateScheduleDTO {
  name: string;
  description?: string | null;
  type: 'check_in' | 'check_out' | 'both';
  start_time: string;
  end_time: string;
  days_of_week: string[];
  grace_minutes: number;
  late_threshold_minutes: number;
  early_leave_threshold_minutes: number;
  is_active: boolean;
  target_type: 'all' | 'departments' | 'positions' | 'sections' | 'classes' | 'specific_users';
  target_ids?: number[] | null;
}

export interface CreateAttendanceTypeDTO {
  name: string;
  description?: string | null;
  requires_check_out: boolean;
  color: string;
  affects_attendance_percentage: boolean;
  is_paid: boolean;
  is_active: boolean;
}

export interface ManualAttendanceDTO {
  user_id: number;
  status: 'check_in' | 'check_out';
  method: 'card' | 'backup_code' | 'fingerprint' | 'manual' | 'face_recognition';
  notes?: string | null;
  attendance_type_id?: number | null;
  timestamp?: string;
}

export const attendanceAPI = {
  // Records
  getRecords: (organizationId: number, params?: any) => 
    api.get(`/organizations/${organizationId}/attendance`, { params }),
  
  getStats: (organizationId: number, params?: any) => 
    api.get(`/organizations/${organizationId}/attendance/stats`, { params }),
  
  createManual: (organizationId: number, data: ManualAttendanceDTO) => 
    api.post(`/organizations/${organizationId}/attendance/manual`, data),
  
  // Schedules
  getSchedules: (organizationId: number) => 
    api.get(`/organizations/${organizationId}/schedules`),
  
  createSchedule: (organizationId: number, data: CreateScheduleDTO) => 
    api.post(`/organizations/${organizationId}/schedules`, data),
  
  updateSchedule: (scheduleId: number, data: Partial<CreateScheduleDTO>) => 
    api.put(`/schedules/${scheduleId}`, data),
  
  deleteSchedule: (scheduleId: number) => 
    api.delete(`/schedules/${scheduleId}`),
  
  // Attendance Types
  getAttendanceTypes: (organizationId: number) => 
    api.get(`/organizations/${organizationId}/attendance-types`),
  
  createAttendanceType: (organizationId: number, data: CreateAttendanceTypeDTO) => 
    api.post(`/organizations/${organizationId}/attendance-types`, data),
  
  updateAttendanceType: (typeId: number, data: Partial<CreateAttendanceTypeDTO>) => 
    api.put(`/attendance-types/${typeId}`, data),
  
  deleteAttendanceType: (typeId: number) => 
    api.delete(`/attendance-types/${typeId}`),
};