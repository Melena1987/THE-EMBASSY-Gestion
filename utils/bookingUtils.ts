import type { Bookings, ConsolidatedBooking, BookingDetails } from '../types';
import { SPACES } from '../constants';
import { formatDateForBookingKey } from './dateUtils';

// --- Pre-calculated constants to avoid re-computation on every call ---

const spaceIdToNameMap = SPACES.reduce((acc, space) => {
    acc[space.id] = space.name;
    return acc;
}, {} as Record<string, string>);

const spaceNameToIdMap = SPACES.reduce((acc, space) => {
    acc[space.name] = space.id;
    return acc;
}, {} as Record<string, string>);

const groupDefinitions = (() => {
    const allSpaceIds = SPACES.map(s => s.id);
    const court1Ids = SPACES.filter(s => s.group === 'Pista 1').map(s => s.id);
    const court2Ids = SPACES.filter(s => s.group === 'Pista 2').map(s => s.id);
    const meetingRoomIds = SPACES.filter(s => s.group === 'Salas').map(s => s.id);
    const lockerRoomIds = SPACES.filter(s => s.group === 'Vestuarios').map(s => s.id);

    return [
        { name: 'TODA LA INSTALACIÓN', ids: new Set(allSpaceIds) },
        { name: 'PISTA 1 Y 2', ids: new Set([...court1Ids, ...court2Ids]) },
        { name: 'Pista 1', ids: new Set(court1Ids) },
        { name: 'Pista 2', ids: new Set(court2Ids) },
        { name: 'TODAS LAS SALAS', ids: new Set(meetingRoomIds) },
        { name: 'TODOS LOS VESTUARIOS', ids: new Set(lockerRoomIds) },
    ];
})();

const add30Minutes = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    const newDate = new Date();
    newDate.setHours(h, m + 30, 0, 0);
    return `${newDate.getHours().toString().padStart(2, '0')}:${newDate.getMinutes().toString().padStart(2, '0')}`;
};


/**
 * Extracts all individual 30-minute booking slots for a specific day.
 * @param bookings - The global bookings object.
 * @param dateString - The date in 'YYYY-MM-DD' format.
 * @returns An array of individual booking slots.
 */
const _getIndividualSlotsForDay = (bookings: Bookings, dateString: string) => {
    const individualSlots: { time: string; space: string; details: BookingDetails, key: string }[] = [];
    for (const key in bookings) {
        if (key.includes(dateString)) {
            const details = bookings[key];
            if (details.name.startsWith('EVENTO:')) {
                continue; // Ignore bookings created by special events
            }
            const parts = key.split('-');
            const time = parts.slice(-1)[0];
            const spaceId = parts.slice(0, -4).join('-');
            individualSlots.push({
                time,
                space: spaceIdToNameMap[spaceId] || spaceId,
                details,
                key
            });
        }
    }
    return individualSlots;
};

/**
 * Consolidates consecutive 30-minute time slots into larger time blocks.
 * @param individualSlots - An array of individual booking slots for a day.
 * @param dateString - The date in 'YYYY-MM-DD' format.
 * @returns An array of bookings with consolidated start and end times.
 */
const _consolidateTimeSlots = (individualSlots: ReturnType<typeof _getIndividualSlotsForDay>, dateString: string) => {
    if (individualSlots.length === 0) return [];

    const bookingsByCompositeKey: Record<string, { time: string, key: string }[]> = {};
    individualSlots.forEach(slot => {
        const key = `${slot.space}#${slot.details.name}#${slot.details.observations || ''}`;
        if (!bookingsByCompositeKey[key]) {
            bookingsByCompositeKey[key] = [];
        }
        bookingsByCompositeKey[key].push({ time: slot.time, key: slot.key });
    });

    const timeConsolidatedBookings: ConsolidatedBooking[] = [];
    for (const key in bookingsByCompositeKey) {
        const [space, name] = key.split('#');
        const sortedSlots = bookingsByCompositeKey[key].sort((a, b) => a.time.localeCompare(b.time));
        if (sortedSlots.length === 0) continue;

        const originalSlot = individualSlots.find(s => s.key === sortedSlots[0].key);
        if (!originalSlot) continue;

        let currentStartTime = sortedSlots[0].time;
        let lastTime = sortedSlots[0].time;
        let currentKeys = [sortedSlots[0].key];

        for (let i = 1; i < sortedSlots.length; i++) {
            if (sortedSlots[i].time === add30Minutes(lastTime)) {
                lastTime = sortedSlots[i].time;
                currentKeys.push(sortedSlots[i].key);
            } else {
                timeConsolidatedBookings.push({ date: dateString, startTime: currentStartTime, endTime: add30Minutes(lastTime), space, details: originalSlot.details, keys: currentKeys });
                currentStartTime = sortedSlots[i].time;
                lastTime = sortedSlots[i].time;
                currentKeys = [sortedSlots[i].key];
            }
        }
        timeConsolidatedBookings.push({ date: dateString, startTime: currentStartTime, endTime: add30Minutes(lastTime), space, details: originalSlot.details, keys: currentKeys });
    }
    return timeConsolidatedBookings;
};

/**
 * Consolidates individual space bookings into larger group names (e.g., "Pista 1, Pista 2" becomes "PISTA 1 Y 2").
 * @param timeConsolidatedBookings - Bookings already consolidated by time.
 * @returns The final array of consolidated bookings for the day.
 */
const _consolidateSpaceGroups = (timeConsolidatedBookings: ConsolidatedBooking[]) => {
    if (timeConsolidatedBookings.length === 0) return [];

    const bookingsGroupedForSpaceConsolidation: Record<string, ConsolidatedBooking[]> = {};
    timeConsolidatedBookings.forEach(booking => {
        const key = `${booking.startTime}-${booking.endTime}-${booking.details.name}`;
        if (!bookingsGroupedForSpaceConsolidation[key]) {
            bookingsGroupedForSpaceConsolidation[key] = [];
        }
        bookingsGroupedForSpaceConsolidation[key].push(booking);
    });

    const finalBookings: ConsolidatedBooking[] = [];
    for (const key in bookingsGroupedForSpaceConsolidation) {
        const bookingsInGroup = bookingsGroupedForSpaceConsolidation[key];
        const { date, startTime, endTime, details } = bookingsInGroup[0];

        const bookingsBySpaceId = bookingsInGroup.reduce((acc, b) => {
            const spaceId = spaceNameToIdMap[b.space];
            if (spaceId) acc[spaceId] = b;
            return acc;
        }, {} as Record<string, ConsolidatedBooking>);

        const unhandledSpaceIds = new Set(Object.keys(bookingsBySpaceId));
        let allKeysForThisSlot: string[] = [];
        const consolidatedSpaceNames: string[] = [];

        for (const groupDef of groupDefinitions) {
            const groupIds = [...groupDef.ids];
            if (groupIds.length > 0 && groupIds.every(id => unhandledSpaceIds.has(id))) {
                if (groupDef.name === 'TODA LA INSTALACIÓN' && groupDef.ids.size === unhandledSpaceIds.size) {
                    consolidatedSpaceNames.push(groupDef.name);
                    allKeysForThisSlot.push(...[...unhandledSpaceIds].flatMap(id => bookingsBySpaceId[id].keys));
                    unhandledSpaceIds.clear();
                    break;
                }
                consolidatedSpaceNames.push(groupDef.name);
                allKeysForThisSlot.push(...groupIds.flatMap(id => bookingsBySpaceId[id].keys));
                groupIds.forEach(id => unhandledSpaceIds.delete(id));
            }
        }

        const remainingIndividualSpaces = [...unhandledSpaceIds].map(id => bookingsBySpaceId[id].space).sort();
        allKeysForThisSlot.push(...[...unhandledSpaceIds].flatMap(id => bookingsBySpaceId[id].keys));
        consolidatedSpaceNames.push(...remainingIndividualSpaces);

        if (consolidatedSpaceNames.length > 0) {
            finalBookings.push({ date, startTime, endTime, space: consolidatedSpaceNames.join(', '), details, keys: allKeysForThisSlot });
        }
    }
    return finalBookings;
};

/**
 * Consolidates all bookings for a given day.
 * It merges consecutive time slots and groups spaces under collective names.
 * Example: A booking from 9:00-10:00 on Pista 1 & Pista 2 becomes one entry.
 * @param bookings The complete bookings object.
 * @param date The date for which to consolidate bookings.
 * @returns An array of ConsolidatedBooking objects for the day, sorted by time and space.
 */
export const consolidateBookingsForDay = (bookings: Bookings, date: Date): ConsolidatedBooking[] => {
    const dateString = formatDateForBookingKey(date);
    
    // Step 1: Get all raw 30-min slots for the day
    const individualSlots = _getIndividualSlotsForDay(bookings, dateString);
    if (!individualSlots.length) return [];

    // Step 2: Merge consecutive time slots
    const timeConsolidatedBookings = _consolidateTimeSlots(individualSlots, dateString);
    if (!timeConsolidatedBookings || !timeConsolidatedBookings.length) return [];

    // Step 3: Group spaces (e.g., Pista 1 + Pista 2 -> PISTA 1 Y 2)
    const finalBookings = _consolidateSpaceGroups(timeConsolidatedBookings);
    if (!finalBookings || !finalBookings.length) return [];

    // Final sort
    return finalBookings.sort((a, b) => {
        if (a.startTime !== b.startTime) {
            return a.startTime.localeCompare(b.startTime);
        }
        return a.space.localeCompare(b.space);
    });
};


/**
 * Finds all recurring bookings related to a selected one.
 * It matches bookings with the same name, observations, duration, and spaces across different dates.
 * @param selectedBooking The booking to find relatives for.
 * @param allBookings The entire bookings collection.
 * @returns An array of objects, each containing the date and keys for a related occurrence.
 */
export const findRelatedBookings = (selectedBooking: ConsolidatedBooking, allBookings: Bookings): { date: string, keys: string[] }[] => {
    const { name, observations } = selectedBooking.details;
    const { startTime, endTime } = selectedBooking;
    
    const selectedSpaceIds = new Set(selectedBooking.keys.map(key => key.split('-').slice(0, -4).join('-')));

    if (selectedSpaceIds.size === 0) return [{ date: selectedBooking.date, keys: selectedBooking.keys }];

    const relevantTimeSlots = new Set<string>();
    let currentTime = startTime;
    while (currentTime < endTime) {
        relevantTimeSlots.add(currentTime);
        currentTime = add30Minutes(currentTime);
    }

    const potentialSlots = Object.entries(allBookings).filter(([, details]) => 
        details.name === name && details.observations === observations
    );

    const bookingsByDate: Record<string, string[]> = {};
    potentialSlots.forEach(([key]) => {
        const keyDate = key.split('-').slice(-4, -1).join('-');
        if (!bookingsByDate[keyDate]) {
            bookingsByDate[keyDate] = [];
        }
        bookingsByDate[keyDate].push(key);
    });
    
    const relatedOccurrences = Object.entries(bookingsByDate).filter(([, keys]) => {
        const groupSpaceIds = new Set(keys.map(key => key.split('-').slice(0, -4).join('-')));
        const timeSlotsInGroup = new Set(keys.map(key => key.split('-').slice(-1)[0]));

        // Check if the set of spaces and times match the original booking
        return groupSpaceIds.size === selectedSpaceIds.size &&
               [...selectedSpaceIds].every(id => groupSpaceIds.has(id)) &&
               timeSlotsInGroup.size === relevantTimeSlots.size &&
               [...relevantTimeSlots].every(time => timeSlotsInGroup.has(time));
    }).map(([date, keys]) => ({ date, keys }));
    
    return relatedOccurrences.sort((a, b) => a.date.localeCompare(b.date));
};
