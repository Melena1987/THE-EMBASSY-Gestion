import { WORKERS } from '../constants';
import type { DailyShift, ShiftAssignment, ShiftPeriodDetail } from '../types';

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


/**
 * Calculates the updated shift assignment for a week after a daily change.
 * This pure function encapsulates the logic for updating a day's shift,
 * handling worker swaps, and determining if a daily override should be kept or removed.
 * @param currentWeekShifts The current shift assignment for the week.
 * @param dayIndex The index of the day being modified (0-6).
 * @param period The shift period ('morning' or 'evening').
 * @param field The field within the period detail being changed.
 * @param value The new value for the field.
 * @returns The new, updated ShiftAssignment object for the week.
 */
export const calculateUpdatedShifts = (
    currentWeekShifts: ShiftAssignment,
    dayIndex: number,
    period: 'morning' | 'evening',
    field: keyof ShiftPeriodDetail,
    value: string | boolean
): ShiftAssignment => {
    // Deep copy to avoid mutations
    const newShifts: ShiftAssignment = JSON.parse(JSON.stringify(currentWeekShifts));

    if (!newShifts.dailyOverrides) {
        newShifts.dailyOverrides = {};
    }

    const weeklyDefaults = { morning: newShifts.morning, evening: newShifts.evening };

    // Get the current state for the day, or the default if no override exists
    const currentDailyState = newShifts.dailyOverrides[dayIndex]
        ? newShifts.dailyOverrides[dayIndex]
        : getDefaultDailyShift(dayIndex, weeklyDefaults.morning, weeklyDefaults.evening);

    // Create a mutable copy for this day's update
    const updatedDailyState: DailyShift = JSON.parse(JSON.stringify(currentDailyState));

    // Apply the specific change
    (updatedDailyState[period] as any)[field] = value;

    // Handle worker swap logic
    if (field === 'worker') {
        const otherPeriod = period === 'morning' ? 'evening' : 'morning';
        if (updatedDailyState[otherPeriod].worker === value) {
            updatedDailyState[otherPeriod].worker = WORKERS.find(w => w !== value) || '';
        }
    }

    // Check if the updated state is the same as the default for that day
    const defaultStateForDay = getDefaultDailyShift(dayIndex, weeklyDefaults.morning, weeklyDefaults.evening);
    const isSameAsDefault =
        JSON.stringify(updatedDailyState.morning) === JSON.stringify(defaultStateForDay.morning) &&
        JSON.stringify(updatedDailyState.evening) === JSON.stringify(defaultStateForDay.evening);

    // If it's the same as default, remove the override. Otherwise, set it.
    if (isSameAsDefault) {
        delete newShifts.dailyOverrides[dayIndex];
    } else {
        newShifts.dailyOverrides[dayIndex] = updatedDailyState;
    }

    // If there are no more daily overrides, remove the entire object
    if (Object.keys(newShifts.dailyOverrides).length === 0) {
        delete newShifts.dailyOverrides;
    }

    return newShifts;
};