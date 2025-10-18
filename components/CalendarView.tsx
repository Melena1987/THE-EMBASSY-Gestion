import React, { useState, useMemo } from 'react';
import type { Bookings, View, ConsolidatedBooking, BookingDetails, ShiftAssignments } from '../types';
import { SPACES, WORKERS } from '../constants';
import { getWeekData, formatDateForBookingKey } from '../utils/dateUtils';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import SwitchIcon from './icons/SwitchIcon';


interface CalendarViewProps {
    bookings: Bookings;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    setView: (view: View) => void;
    shiftAssignments: ShiftAssignments;
}

const CalendarView: React.FC<CalendarViewProps> = ({ bookings, selectedDate, onDateChange, setView, shiftAssignments }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

    const spaceIdToNameMap = useMemo(() => 
        SPACES.reduce((acc, space) => {
            acc[space.id] = space.name;
            return acc;
        }, {} as Record<string, string>), 
    []);

    const spaceNameToIdMap = useMemo(() => 
        SPACES.reduce((acc, space) => {
            acc[space.name] = space.id;
            return acc;
        }, {} as Record<string, string>),
    []);

    const groupDefinitions = useMemo(() => {
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
    }, []);

    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    const dayOfWeek = startDate.getDay(); // 0 for Sunday, 1 for Monday
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Calculate offset to make Monday the first day
    startDate.setDate(startDate.getDate() - offset);


    const days = [];
    let day = startDate;
    // Ensure the grid always has 6 weeks for consistent height
    while (days.length < 42) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }
    
    const weeks = useMemo(() => {
        const weekChunks = [];
        for (let i = 0; i < days.length; i += 7) {
            weekChunks.push(days.slice(i, i + 7));
        }
        return weekChunks;
    }, [days]);
    
    const changeMonth = (offset: number) => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };
    
    const getBookingsForDay = (date: Date): ConsolidatedBooking[] => {
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

    const handleDayClick = (date: Date) => {
        onDateChange(date);
        setView('agenda');
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 sm:p-6 rounded-lg shadow-lg border border-white/10" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-white/10 rounded-md hover:bg-white/20">&lt;</button>
                <h2 className="text-xl font-bold text-white capitalize">
                    {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-white/10 rounded-md hover:bg-white/20">&gt;</button>
            </div>
            
            <div className="grid grid-cols-[auto,1fr,1fr,1fr,1fr,1fr,1fr,1fr] gap-1 text-center font-semibold text-orange-400 mb-2">
                <div></div>
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-[auto,1fr,1fr,1fr,1fr,1fr,1fr,1fr] gap-1 sm:gap-2">
                {weeks.map((weekDays, i) => {
                    const firstDayOfWeek = weekDays[0];
                    const { week, year } = getWeekData(firstDayOfWeek);
                    const weekId = `${year}-${week.toString().padStart(2, '0')}`;
                    
                    const isEvenWeek = week % 2 === 0;
                    const defaultMorning = isEvenWeek ? WORKERS[1] : WORKERS[0];
                    const defaultEvening = defaultMorning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
                    
                    const weeklyShifts = shiftAssignments[weekId];
                    const morningWorker = weeklyShifts?.morning || defaultMorning;
                    const eveningWorker = weeklyShifts?.evening || defaultEvening;
                    
                    return (
                        <React.Fragment key={i}>
                            <div className="flex flex-col items-center justify-center bg-black/20 rounded-md text-xs px-2 py-1 h-full">
                                <div className="space-y-2 my-1 text-center">
                                    <div className="flex items-center gap-1 text-yellow-300" title={`Mañana: ${morningWorker}`}>
                                        <SunIcon className="w-4 h-4" />
                                        <span className="font-mono font-bold">{morningWorker.substring(0, 2).toUpperCase()}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-blue-300" title={`Tarde: ${eveningWorker}`}>
                                        <MoonIcon className="w-4 h-4" />
                                        <span className="font-mono font-bold">{eveningWorker.substring(0, 2).toUpperCase()}</span>
                                    </div>
                                </div>
                            </div>

                            {weekDays.map((d, j) => {
                                const dayBookings = getBookingsForDay(d);
                                const isCurrentMonth = d.getMonth() === currentMonth.getMonth();
                                const isSelected = isSameDay(d, selectedDate);
                                
                                const dayWeekData = getWeekData(d);
                                const dayWeekId = `${dayWeekData.year}-${dayWeekData.week.toString().padStart(2, '0')}`;
                                const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
                                const hasOverride = !!shiftAssignments[dayWeekId]?.dailyOverrides?.[dayIndex];

                                return (
                                    <button
                                        key={j}
                                        onClick={() => handleDayClick(d)}
                                        className={`relative p-1 sm:p-2 h-28 sm:h-32 md:h-36 rounded-md transition-colors duration-200 flex flex-col items-start text-left overflow-hidden ${
                                            isSelected ? 'bg-orange-600 ring-2 ring-orange-300' : 'bg-black/20'
                                        } ${isCurrentMonth ? 'text-white hover:bg-black/40' : 'text-gray-500 hover:bg-black/40'}`}
                                    >
                                        <div className="flex justify-between w-full items-center mb-1">
                                            <span className="font-bold text-sm">{d.getDate()}</span>
                                            {hasOverride && <span className="h-2 w-2 bg-blue-400 rounded-full" title="Horario especial"></span>}
                                        </div>

                                        {dayBookings.length > 0 && (
                                            <div className="text-xs w-full space-y-1 flex-grow overflow-y-auto pr-1">
                                                {dayBookings.map((booking, index) => (
                                                    <div key={index} className="bg-black/30 rounded px-1.5 py-0.5 truncate" title={`${booking.startTime} - ${booking.details.name}`}>
                                                        <span className="font-semibold text-orange-400">{booking.startTime}</span> {booking.details.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </React.Fragment>
                    )
                })}
            </div>
        </div>
    );
};

export default CalendarView;