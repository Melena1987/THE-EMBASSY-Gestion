// FIX: The User type was missing from this file. It is re-exported from firebase/auth to be available across the app.
export type { User } from 'firebase/auth';

export type View = 'plano' | 'calendario' | 'agenda' | 'detalles' | 'turnos' | 'servicios' | 'eventos' | 'detalles_evento' | 'sponsors';

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
  recurrenceId?: string;
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

export interface Sponsor {
  id: string; // Document ID from Firestore
  name: string;
  tasks?: Task[];
  allianceDate?: string; // YYYY-MM-DD
  annualContribution?: number;
  contactPhone?: string;
  instagramUrl?: string;
  observations?: string;
}
export type Sponsors = Record<string, Sponsor>; // Key is the sponsor ID

export type TaskSourceCollection = 'shiftAssignments' | 'specialEvents' | 'sponsors';

export interface AggregatedTask extends Task {
  sourceCollection: TaskSourceCollection;
  sourceId: string;
  sourceName: string;
}