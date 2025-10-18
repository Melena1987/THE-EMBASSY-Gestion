import React, { useMemo } from 'react';
import type { Bookings, ConsolidatedBooking, BookingDetails, View, ShiftAssignments } from '../types';
import { WORKERS, SPACES } from '../constants';
import { getWeekData, formatDateForBookingKey } from '../utils/dateUtils';
import PlusIcon from './icons/PlusIcon';

interface AgendaViewProps {
    bookings: Bookings;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onSelectBooking: (booking: ConsolidatedBooking) => void;
    setView: (view: View) => void;
    shiftAssignments: ShiftAssignments;
}

const AgendaView: React.FC<AgendaViewProps> = ({ bookings, selectedDate, onDateChange, onSelectBooking, setView, shiftAssignments }) => {

    const weekDays = useMemo(() => {
        const startOfWeek = new Date(selectedDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1); // Adjust to make Monday the first day
        startOfWeek.setDate(diff);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            return date;
        });
    }, [selectedDate]);

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

    const { week: weekNumber, year } = getWeekData(selectedDate);
    const weekId = `${year}-${weekNumber.toString().padStart(2, '0')}`;

    const defaultAssignments = useMemo(() => {
        const isEvenWeek = weekNumber % 2 === 0;
        const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
        const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
        return { morning, evening };
    }, [weekNumber]);

    const currentWeekShifts = shiftAssignments[weekId] || defaultAssignments;
    const hasOverrides = !!(shiftAssignments[weekId]?.dailyOverrides && Object.keys(shiftAssignments[weekId]!.dailyOverrides!).length > 0);

    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + offset * 7);
        onDateChange(newDate);
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

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                    <h2 className="text-xl font-bold text-white text-center">
                        Semana {weekNumber} <br />
                        <span className="text-sm font-normal text-gray-400">
                            {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </h2>
                    <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente Semana &gt;</button>
                </div>
                 <div className="text-center bg-black/20 p-3 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                        <p className="font-semibold text-orange-400">Turno Mañana (defecto)</p>
                        <p>{currentWeekShifts.morning}</p>
                    </div>
                    <div>
                        <p className="font-semibold text-yellow-400">Turno Tarde (defecto)</p>
                        <p>{currentWeekShifts.evening}</p>
                    </div>
                </div>
                {hasOverrides && (
                    <div className="text-center text-sm text-blue-300 bg-blue-900/40 p-2 rounded-md mt-2">
                        <p>⚠️ Esta semana contiene días con horarios especiales.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {weekDays.map(day => {
                    const dayBookings = getBookingsForDay(day);
                    const dayWeekData = getWeekData(day);
                    const dayWeekId = `${dayWeekData.year}-${dayWeekData.week.toString().padStart(2, '0')}`;
                    const dayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1;
                    const dailyOverride = shiftAssignments[dayWeekId]?.dailyOverrides?.[dayIndex];

                    const shiftsText: string[] = [];
                    if (dailyOverride?.morning.active) {
                        shiftsText.push(`M: ${dailyOverride.morning.start}-${dailyOverride.morning.end} (${dailyOverride.morning.worker})`);
                    }
                    if (dailyOverride?.evening.active) {
                        shiftsText.push(`T: ${dailyOverride.evening.start}-${dailyOverride.evening.end} (${dailyOverride.evening.worker})`);
                    }
                    
                    return (
                        <div key={day.toISOString()} className="bg-white/5 backdrop-blur-lg p-3 rounded-lg shadow-inner min-h-[200px] flex flex-col border border-white/10">
                            <div className="text-center border-b border-white/20 pb-2 mb-2">
                                <h3 className="font-bold capitalize text-white">
                                    {day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                </h3>
                                {dailyOverride && (
                                    <div className="text-xs text-blue-300 mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                                        {shiftsText.length > 0 ? (
                                            shiftsText.map((text, index) => <p key={index} className="leading-tight">{text}</p>)
                                        ) : (
                                            <p className="text-red-400 font-semibold">Cerrado</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2 text-xs flex-grow">
                                {dayBookings.length > 0 ? (
                                    dayBookings.map((booking, index) => (
                                        <button key={index} onClick={() => onSelectBooking(booking)} className="w-full text-left bg-black/20 p-2 rounded hover:bg-black/40 transition-colors duration-200">
                                            <p className="font-semibold text-orange-300">
                                                {booking.startTime} - {booking.endTime}
                                            </p>
                                            <ul className="list-disc list-inside pl-2 text-gray-300">
                                                <li className="capitalize">
                                                    {booking.space}: <span className="font-semibold text-white">{booking.details.name}</span>
                                                </li>
                                            </ul>
                                        </button>
                                    ))
                                 ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                                        <p>Sin reservas</p>
                                    </div>
                                )}
                            </div>
                             <div className="flex justify-center pt-2 mt-auto">
                                <button 
                                    onClick={() => { onDateChange(day); setView('plano'); }}
                                    className="bg-black/20 hover:bg-black/40 text-orange-400 p-2 rounded-full transition-colors"
                                    aria-label={`Añadir reserva para ${day.toLocaleDateString('es-ES')}`}
                                    title="Añadir reserva"
                                >
                                    <PlusIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AgendaView;