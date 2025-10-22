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

                // This check is crucial to handle month-end transitions correctly.
                // For example, if the start date is January 31, adding a month would result in
                // March 3 (since February has 28/29 days). This check ensures we only yield
                // dates that fall on the same day of the month as the original start date.
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


/**
 * Calculates the Date object for the Monday of a given week number and year.
 * @param year The year.
 * @param week The week number (ISO 8601).
 * @returns A Date object for the Monday of that week.
 */
export const getMondayOfWeek = (year: number, week: number): Date => {
    // The calculation for the first day of an ISO week is a bit tricky.
    // Start with Jan 4th of the year, as it's always in week 1.
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7; // Sunday is 0, make it 7.
    
    // Calculate the date of the Monday of week 1.
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - (jan4Day - 1));

    // Add the required number of weeks (minus 1, as we're already on week 1's Monday).
    const targetMonday = new Date(week1Monday);
    targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);

    return targetMonday;
};