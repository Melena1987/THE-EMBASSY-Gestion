import type { Bookings, ConsolidatedBooking, BookingDetails } from '../types';
import { SPACES } from '../constants';
import { formatDateForBookingKey } from './dateUtils';

export const consolidateBookingsForDay = (bookings: Bookings, date: Date): ConsolidatedBooking[] => {
    // Generate maps and definitions internally
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
            { name: 'INSTALACIÓN COMPLETA', ids: new Set(allSpaceIds) },
            { name: 'PISTA 1 Y 2', ids: new Set([...court1Ids, ...court2Ids]) },
            { name: 'Pista 1', ids: new Set(court1Ids) },
            { name: 'Pista 2', ids: new Set(court2Ids) },
            { name: 'TODAS LAS SALAS', ids: new Set(meetingRoomIds) },
            { name: 'TODOS LOS VESTUARIOS', ids: new Set(lockerRoomIds) },
        ];
    })();

    const dateString = formatDateForBookingKey(date);
    
    const add30Minutes = (time: string): string => {
        const [h, m] = time.split(':').map(Number);
        const newDate = new Date();
        newDate.setHours(h, m + 30, 0, 0);
        return `${newDate.getHours().toString().padStart(2, '0')}:${newDate.getMinutes().toString().padStart(2, '0')}`;
    };

    const individualSlots: { time: string; space: string; details: BookingDetails, key: string }[] = [];
    for (const key in bookings) {
        if (Object.prototype.hasOwnProperty.call(bookings, key) && key.includes(dateString)) {
            const details = bookings[key];
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
    
    if (individualSlots.length === 0) return [];

    const bookingsByCompositeKey: Record<string, { time: string, key: string }[]> = {};
    individualSlots.forEach(slot => {
        const key = `${slot.space}#${slot.details.name}`;
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
        const bookingDetails = originalSlot.details;


        let currentStartTime = sortedSlots[0].time;
        let lastTime = sortedSlots[0].time;
        let currentKeys = [sortedSlots[0].key];

        for (let i = 1; i < sortedSlots.length; i++) {
            if (sortedSlots[i].time === add30Minutes(lastTime)) {
                lastTime = sortedSlots[i].time;
                currentKeys.push(sortedSlots[i].key);
            } else {
                timeConsolidatedBookings.push({
                    date: dateString,
                    startTime: currentStartTime,
                    endTime: add30Minutes(lastTime),
                    space,
                    details: bookingDetails,
                    keys: currentKeys
                });
                currentStartTime = sortedSlots[i].time;
                lastTime = sortedSlots[i].time;
                currentKeys = [sortedSlots[i].key];
            }
        }
        timeConsolidatedBookings.push({
            date: dateString,
            startTime: currentStartTime,
            endTime: add30Minutes(lastTime),
            space,
            details: bookingDetails,
            keys: currentKeys
        });
    }
    
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

        const bookingsBySpaceId: Record<string, ConsolidatedBooking> = {};
        bookingsInGroup.forEach(b => {
            const spaceId = spaceNameToIdMap[b.space];
            if (spaceId) {
                bookingsBySpaceId[spaceId] = b;
            }
        });

        const unhandledSpaceIds = new Set(Object.keys(bookingsBySpaceId));
        const consolidatedSpaceNames: string[] = [];
        let allKeysForThisSlot: string[] = [];

        for (const groupDef of groupDefinitions) {
            if ([...groupDef.ids].every(id => unhandledSpaceIds.has(id))) {
                consolidatedSpaceNames.push(groupDef.name);
                const groupKeys = [...groupDef.ids].flatMap(id => bookingsBySpaceId[id].keys);
                allKeysForThisSlot.push(...groupKeys);
                
                [...groupDef.ids].forEach(id => unhandledSpaceIds.delete(id));
            }
        }

        const remainingIndividualSpaces: string[] = [];
        unhandledSpaceIds.forEach(id => {
            const individualBooking = bookingsBySpaceId[id];
            remainingIndividualSpaces.push(individualBooking.space);
            allKeysForThisSlot.push(...individualBooking.keys);
        });
        
        remainingIndividualSpaces.sort();
        consolidatedSpaceNames.push(...remainingIndividualSpaces);

        if (consolidatedSpaceNames.length > 0) {
             finalBookings.push({
                date,
                startTime,
                endTime,
                space: consolidatedSpaceNames.join(', '),
                details,
                keys: allKeysForThisSlot,
            });
        }
    }

    return finalBookings.sort((a, b) => {
        if (a.startTime !== b.startTime) {
            return a.startTime.localeCompare(b.startTime);
        }
        return a.space.localeCompare(b.space);
    });
};