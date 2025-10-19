export type View = 'plano' | 'calendario' | 'agenda' | 'detalles' | 'turnos' | 'servicios' | 'eventos' | 'detalles_evento';

export type UserRole = 'ADMIN' | 'TRABAJADOR' | 'EVENTOS' | null;

export interface Space {
  id: string;
  name: string;
  group: string;
}

export interface BookingDetails {
  name: string;
  observations?: string;
}

// Key format: "spaceId-YYYY-MM-DD-HH:mm"
export type Bookings = Record<string, BookingDetails>;

export interface ConsolidatedBooking {
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  space: string;
  details: BookingDetails;
  keys: string[];
}

export interface ShiftPeriodDetail {
    worker: string;
    start: string;
    end: string;
    active: boolean;
}

export interface DailyShift {
    morning: ShiftPeriodDetail;
    evening: ShiftPeriodDetail;
}

export interface Task {
  id: string;
  text: string;
  assignedTo: string[];
  completed: boolean;
}

// Key format: "YYYY-WW" e.g., "2024-32"
export interface ShiftAssignment {
    morning: string; // Default worker name for the week
    evening: string; // Default worker name for the week
    dailyOverrides?: Record<string, DailyShift>; // Key is day index '0'-'6' from Monday
    observations?: string;
    tasks?: Task[];
}
export type ShiftAssignments = Record<string, ShiftAssignment>;

// Key format: "YYYY-MM-DD"
export type CleaningAssignments = Record<string, { startTime: string }>;

// Key format: "YYYY-WW"
export type CleaningObservations = Record<string, { observations: string }>;

export interface SpecialEvent {
  id: string; // Unique ID
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  spaceIds?: string[];
  tasks?: Task[];
  observations?: string;
  posterUrl?: string;
}
export type SpecialEvents = Record<string, SpecialEvent>; // Key is unique id