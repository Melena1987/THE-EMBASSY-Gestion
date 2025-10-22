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
    
    return {
        morning: {
            worker: weeklyMorningWorker,
            start: '09:00',
            end: '14:00',
            active: dayIndex !== 6, // Not active on Sunday
        },
        evening: {
            worker: weeklyEveningWorker,
            start: '17:00',
            end: '23:00',
            active: isWeekday, // Active Monday to Friday
        }
    };
};


/**
 * Calculates the updated shift assignment for a week after a daily change.
 * This is a PURE FUNCTION: it receives the current state and returns a new,
 * updated state without modifying the original object (immutability).
 * 
 * It determines if a daily override is needed or if the change reverts the day
 * to its default state, in which case the override is removed to keep the data clean.
 * 
 * @param currentWeekShifts The current shift assignment for the week.
 * @param dayIndex The index of the day being modified (0-6).
 * @param period The shift period ('morning' or 'evening').
 * @param field The field within the period detail being changed (e.g., 'worker', 'active').
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
    // Deep copy to ensure immutability
    const newShifts: ShiftAssignment = structuredClone(currentWeekShifts);

    if (!newShifts.dailyOverrides) {
        newShifts.dailyOverrides = {};
    }

    const weeklyDefaults = { morning: newShifts.morning, evening: newShifts.evening };

    // Get the current state for the day, or create it from the weekly default if no override exists
    const currentDailyState = newShifts.dailyOverrides[dayIndex]
        ? newShifts.dailyOverrides[dayIndex]
        : getDefaultDailyShift(dayIndex, weeklyDefaults.morning, weeklyDefaults.evening);

    // Create a mutable copy for this day's update
    const updatedDailyState: DailyShift = structuredClone(currentDailyState);

    // 1. Apply the specific change
    (updatedDailyState[period] as any)[field] = value;

    // 2. Handle automatic worker swap logic to prevent duplicates in the same day
    if (field === 'worker') {
        const otherPeriod = period === 'morning' ? 'evening' : 'morning';
        if (updatedDailyState[otherPeriod].worker === value) {
            // If the new worker is the same as the one in the other shift, swap them
            updatedDailyState[otherPeriod].worker = currentDailyState[period].worker;
        }
    }

    // 3. Determine if the override is still needed
    const defaultStateForDay = getDefaultDailyShift(dayIndex, weeklyDefaults.morning, weeklyDefaults.evening);
    const isSameAsDefault =
        JSON.stringify(updatedDailyState.morning) === JSON.stringify(defaultStateForDay.morning) &&
        JSON.stringify(updatedDailyState.evening) === JSON.stringify(defaultStateForDay.evening);

    // If the day's state is now identical to the default, remove the override. Otherwise, set/update it.
    if (isSameAsDefault) {
        delete newShifts.dailyOverrides[dayIndex];
    } else {
        newShifts.dailyOverrides[dayIndex] = updatedDailyState;
    }

    // 4. Clean up the dailyOverrides object if it's empty
    if (Object.keys(newShifts.dailyOverrides).length === 0) {
        delete newShifts.dailyOverrides;
    }

    return newShifts;
};
