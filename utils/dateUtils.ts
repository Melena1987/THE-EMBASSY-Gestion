/**
 * Calculates the week number and year for a given date according to ISO 8601.
 * ISO 8601 weeks start on Monday.
 * @param d The date.
 * @returns An object containing the week number and the corresponding year.
 */
export const getWeekData = (d: Date): { week: number, year: number } => {
    // Create a new date object to avoid modifying the original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    
    // Return week number and year
    return { week: weekNo, year: d.getUTCFullYear() };
};

/**
 * Formats a Date object into "YYYY-MM-DD" string based on local time.
 * This is used for creating and querying booking keys consistently.
 * @param date The date to format.
 * @returns The formatted date string.
 */
export const formatDateForBookingKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * A generator function that yields a sequence of dates based on a starting date and a repeat option.
 * @param startDate The initial date for the sequence.
 * @param repeatOption A string indicating the repetition rule ('none', 'daily', 'weekdays', 'weekly', 'monthly').
 * @param endDate The date until which the repetition should occur (inclusive).
 * @param weeklyDays A Set of numbers (0-6, Sunday-Saturday) for weekly repetitions.
 * @returns A Generator that yields Date objects.
 */
export function* generateRepeatingDates(
    startDate: Date, 
    repeatOption: string,
    endDate: Date,
    weeklyDays?: Set<number>
): Generator<Date> {
    const initialDate = new Date(startDate.getTime());

    // Ensure endDate is at the end of the day for correct comparison
    const limitDate = new Date(endDate.getTime());
    limitDate.setHours(23, 59, 59, 999);

    if (initialDate > limitDate) {
        if (repeatOption === 'none') {
             yield initialDate;
        }
        return;
    }
    
    switch (repeatOption) {
        case 'none':
            yield initialDate;
            break;

        case 'daily': {
            for (let d = new Date(initialDate); d <= limitDate; d.setDate(d.getDate() + 1)) {
                yield new Date(d);
            }
            break;
        }

        case 'weekdays': {
            for (let d = new Date(initialDate); d <= limitDate; d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (day > 0 && day < 6) { // Monday to Friday
                    yield new Date(d);
                }
            }
            break;
        }

        case 'weekly': {
            const daysToRepeat = weeklyDays && weeklyDays.size > 0 ? weeklyDays : new Set([initialDate.getDay()]);
            for (let d = new Date(initialDate); d <= limitDate; d.setDate(d.getDate() + 1)) {
                if (daysToRepeat.has(d.getDay())) {
                    yield new Date(d);
                }
            }
            break;
        }

        case 'monthly': {
            for (let i = 0; ; i++) {
                const nextDate = new Date(initialDate);
                nextDate.setMonth(initialDate.getMonth() + i);
                
                if (nextDate > limitDate) break;

                // Only yield if the day of the month hasn't changed (avoids Jan 31 becoming Mar 3)
                if (nextDate.getDate() === initialDate.getDate()) {
                    yield nextDate;
                }
            }
            break;
        }
        
        default:
            yield initialDate; // Fallback to 'none'
            break;
    }
}


/**
 * Converts a time string (HH:mm) to the total number of minutes from midnight.
 * @param time The time string to convert.
 * @returns The number of minutes.
 */
export const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};