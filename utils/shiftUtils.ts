import { WORKERS } from '../constants';
import type { DailyShift } from '../types';

/**
 * Generates the default shift details for a specific day of the week.
 * @param dayIndex The index of the day (0 for Monday, 6 for Sunday).
 * @param weeklyMorningWorker The name of the default morning worker for the week.
 * @param weeklyEveningWorker The name of the default evening worker for the week.
 * @returns A DailyShift object with default times and active status.
 */
export const getDefaultDailyShift = (dayIndex: number, weeklyMorningWorker: string, weeklyEveningWorker:string): DailyShift => {
    const isWeekday = dayIndex >= 0 && dayIndex <= 4;
    const isSaturday = dayIndex === 5;
    const isSunday = dayIndex === 6;

    return {
        morning: {
            worker: weeklyMorningWorker,
            start: isSaturday ? '10:00' : '09:00',
            end: '14:00',
            active: !isSunday,
        },
        evening: {
            worker: weeklyEveningWorker,
            start: '17:00',
            end: '23:00',
            active: isWeekday,
        }
    };
};
