import type { Space } from './types';

export const SPACES: Space[] = [
  { id: 'court1_basketA', name: 'Pista 1 - Canasta A', group: 'Pista 1' },
  { id: 'court1_basketB', name: 'Pista 1 - Canasta B', group: 'Pista 1' },
  { id: 'court2_basketC', name: 'Pista 2 - Canasta C', group: 'Pista 2' },
  { id: 'court2_basketD', name: 'Pista 2 - Canasta D', group: 'Pista 2' },
  { id: 'main_meeting', name: 'Sala de Reuniones Principal', group: 'Salas' },
  { id: 'small_meeting', name: 'Sala de Reuniones Pequeña', group: 'Salas' },
  { id: 'upstairs_room', name: 'Sala de Arriba', group: 'Salas' },
  { id: 'locker_room1', name: 'Vestuario 1', group: 'Vestuarios' },
  { id: 'locker_room2', name: 'Vestuario 2', group: 'Vestuarios' },
];

export const WORKERS: string[] = ['Olga', 'Dani', 'Manu', 'Alfonso'];

export const SPONSOR_ASSIGNEES: string[] = ['Manu', 'Yiyi', 'Berni', 'Manolo'];

export const USER_EMAIL_MAP: Record<string, string> = {
    'daniel.l@theembassytc.com': 'Dani',
    'mescobar@theembassytc.com': 'Manolo',
    'olga.duran@theembassytc.com': 'Olga',
    'berni@theembassytc.com': 'Berni',
    'alfonso@theembassytc.com': 'Alfonso',
    'eventos@theembassytc.com': 'Yiyi',
    'manu@theembassytc.com': 'Manu' // Assuming Manu's email for completeness
};

export const TIME_SLOTS: string[] = [];
// Generate time slots for the entire day in 30-minute intervals.
for (let h = 0; h < 24; h++) {
    const hour = h.toString().padStart(2, '0');
    TIME_SLOTS.push(`${hour}:00`);
    TIME_SLOTS.push(`${hour}:30`);
}