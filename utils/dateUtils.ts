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