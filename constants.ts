import type { Space } from './types';

// The date from which the new default shifts (Adrián/Olga) apply.
// This is Monday, November 17, 2025.
export const SHIFT_CHANGE_DATE = new Date('2025-11-17T00:00:00Z');

export const SPACES: Space[] = [
  { id: 'court1_basketA', name: 'Pista 1 - Canasta A', group: 'Pista 1' },
  { id: 'court1_basketB', name: 'Pista 1 - Canasta B', group: 'Pista 1' },
  { id: 'court2_basketC', name: 'Pista 2 - Canasta C', group: 'Pista 2' },
  { id: 'court2_basketD', name: 'Pista 2 - Canasta D', group: 'Pista 2' },
  { id: 'main_meeting', name: 'Sala de Reuniones Principal', group: 'Salas' },
  { id: 'small_meeting', name: 'Sala de Reuniones Pequeña', group: 'Salas' },
  { id: 'upstairs_room', name: 'Sala de Arriba', group: 'Salas' },
  { id: 'multi_lab', name: 'Sala Multifunción Lab', group: 'Salud' },
  { id: 'physio_office', name: 'Sala Despacho Fisio', group: 'Salud' },
  { id: 'locker_room1', name: 'Vestuario 1', group: 'Vestuarios' },
  { id: 'locker_room2', name: 'Vestuario 2', group: 'Vestuarios' },
];

// Adrián replaces Dani in the list of active workers. Adriana added. Pedro added.
export const WORKERS: string[] = ['Olga', 'Adrián', 'Manu', 'Alfonso', 'Yiyi', 'Adriana', 'Pedro'];

export const SPONSOR_ASSIGNEES: string[] = ['Manu', 'Yiyi', 'Berni', 'Manolo', 'Adriana', 'Pedro'];

// Adrián's email is added, Dani's removed, Adriana added. Pedro added.
export const USER_EMAIL_MAP: Record<string, string> = {
    'adrian@theembassytc.com': 'Adrián',
    'mescobar@theembassytc.com': 'Manolo',
    'olga.duran@theembassytc.com': 'Olga',
    'berni@theembassytc.com': 'Berni',
    'alfonso@theembassytc.com': 'Alfonso',
    'eventos@theembassytc.com': 'Yiyi',
    'manu@theembassytc.com': 'Manu',
    'adriana@theembassytc.com': 'Adriana',
    'noocweb@gmail.com': 'Pedro'
};

export const TIME_SLOTS: string[] = [];
// Generate time slots for the entire day in 30-minute intervals.
for (let h = 0; h < 24; h++) {
    const hour = h.toString().padStart(2, '0');
    TIME_SLOTS.push(`${hour}:00`);
    TIME_SLOTS.push(`${hour}:30`);
}