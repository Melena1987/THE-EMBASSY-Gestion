import React, { useMemo } from 'react';
import type { Bookings, SpecialEvents, SpecialEvent, ShiftAssignment, Vacations, ConsolidatedBooking, BookingDetails } from '../../../types';
import { SPACES, TIME_SLOTS } from '../../../constants';
import { formatDateForBookingKey, timeToMinutes } from '../../../utils/dateUtils';
import { consolidateBookingsForDay } from '../../../utils/bookingUtils';
import { getDefaultDailyShift } from '../../../utils/shiftUtils';

interface AgendaTimelineDayProps {
    day: Date;
    dayIndex: number;
    bookings: Bookings;
    specialEvents: SpecialEvents;
    currentWeekShifts: ShiftAssignment | undefined;
    defaultAssignments: { morning: string; evening: string };
    vacations: Vacations;
    timelineConfig: { startHour: number; endHour: number; pixelsPerMinute: number };
    onSelectSpecialEvent: (event: SpecialEvent) => void;
    onSelectBooking: (booking: ConsolidatedBooking) => void;
    onAddBooking: (bookingKeys: string[], bookingDetails: BookingDetails) => Promise<boolean>;
    isReadOnly: boolean;
}

const isSalaOnly = (booking: ConsolidatedBooking): boolean => {
    if (!booking.keys || booking.keys.length === 0) return false;
    const spaceIds = new Set(booking.keys.map(key => key.split('-').slice(0, -4).join('-')));
    for (const id of spaceIds) {
        const spaceInfo = SPACES.find(s => s.id === id);
        if (!spaceInfo || spaceInfo.group !== 'Salas') {
            return false;
        }
    }
    return spaceIds.size > 0;
};

const AgendaTimelineDay: React.FC<AgendaTimelineDayProps> = ({
    day, dayIndex, bookings, specialEvents, currentWeekShifts, defaultAssignments, vacations, timelineConfig, onSelectSpecialEvent, onSelectBooking, onAddBooking, isReadOnly
}) => {
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, booking: ConsolidatedBooking) => {
        e.dataTransfer.setData('application/json', JSON.stringify(booking));
        (e.target as HTMLDivElement).classList.add('dragging');
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        (e.target as HTMLDivElement).classList.remove('dragging');
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('drag-over');
    };
    
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        try {
            const bookingData: ConsolidatedBooking = JSON.parse(e.dataTransfer.getData('application/json'));
            if (formatDateForBookingKey(day) === bookingData.date) return;
            
            const { startTime, endTime, details, keys: originalKeys } = bookingData;
            
            const spaceIds = [...new Set(originalKeys.map(key => key.split('-').slice(0, -4).join('-')))];
            const timeSlots = TIME_SLOTS.filter(time => time >= startTime && time < endTime);
            const targetDateStr = formatDateForBookingKey(day);
            
            const newKeys = spaceIds.flatMap(spaceId => timeSlots.map(time => `${spaceId}-${targetDateStr}-${time}`));
            
            for (const key of newKeys) {
                if (bookings[key]) {
                    alert(`Conflicto de reserva: El horario de ${startTime} a ${endTime} ya está ocupado el ${day.toLocaleDateString('es-ES')}.`);
                    return;
                }
            }
            await onAddBooking(newKeys, details);
        } catch (error) {
            console.error("Error al soltar la reserva:", error);
            alert("No se pudo duplicar la reserva.");
        }
    };

    const dayKey = formatDateForBookingKey(day);
    const dayYear = day.getFullYear().toString();
    const dayBookings = consolidateBookingsForDay(bookings, day);
    const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);
    const dailyShift = currentWeekShifts?.dailyOverrides?.[dayIndex] || getDefaultDailyShift(dayIndex, currentWeekShifts?.morning || defaultAssignments.morning, currentWeekShifts?.evening || defaultAssignments.evening);
    const isSpecialShift = !!currentWeekShifts?.dailyOverrides?.[dayIndex];

    const vacationWorkerForDay = vacations[dayYear]?.dates[dayKey];
    const isMorningVacation = dailyShift.morning.active && dailyShift.morning.worker === vacationWorkerForDay;
    const isEveningVacation = dailyShift.evening.active && dailyShift.evening.worker === vacationWorkerForDay;

    const timelineHours = Array.from({ length: timelineConfig.endHour - timelineConfig.startHour + 1 }, (_, i) => timelineConfig.startHour + i);
    
    const timedEvents = [
        ...(eventsForDay as SpecialEvent[]).map(event => ({ type: 'event' as const, id: event.id, name: event.name, startTime: event.startTime!, endTime: event.endTime!, spaceIds: event.spaceIds || [] })),
        ...dayBookings.map(booking => ({ type: 'booking' as const, id: booking.keys.join('-'), name: booking.details.name, startTime: booking.startTime, endTime: booking.endTime, spaceIds: booking.keys.map(k => k.split('-').slice(0, -4).join('-')), consolidatedBooking: booking }))
    ].filter(e => e.startTime && e.endTime);

    const processedEvents = useMemo(() => {
        const events = [...timedEvents].map(e => ({
            ...e,
            layout: { left: 0, width: 1, col: 0, totalCols: 1, zIndex: 1 }
        })).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        const overlaps = (a: {startTime: string, endTime: string}, b: {startTime: string, endTime: string}) => timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(a.endTime) > timeToMinutes(b.startTime);

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const collidingEvents = events.slice(0, i).filter(priorEvent => overlaps(event, priorEvent));
            
            const occupiedCols = new Set(collidingEvents.map(e => e.layout.col));
            
            let currentCol = 0;
            while (occupiedCols.has(currentCol)) {
                currentCol++;
            }
            event.layout.col = currentCol;
        }

        for (const event of events) {
            const concurrentEvents = events.filter(e => overlaps(event, e));
            const maxCols = Math.max(...concurrentEvents.map(e => e.layout.col)) + 1;
            
            event.layout.totalCols = maxCols;
            event.layout.width = 1 / maxCols;
            event.layout.left = event.layout.col * event.layout.width;
            event.layout.zIndex = event.layout.col + 1;
        }
        
        return events;
    }, [timedEvents]);

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-lg shadow-inner border border-white/10">
            <div className="p-3 border-b border-white/20 text-center">
                <h3 className="font-bold capitalize text-white">{day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</h3>
                {isSpecialShift ? (
                    <div className="text-xs text-blue-300 font-semibold" title="Horario especial para este día">
                        <div>M: {dailyShift.morning.active ? (isMorningVacation ? <span className="text-purple-400">{dailyShift.morning.worker} (VAC)</span> : `${dailyShift.morning.worker} (${dailyShift.morning.start}-${dailyShift.morning.end})`) : 'Cerrado'}</div>
                        <div>T: {dailyShift.evening.active ? (isEveningVacation ? <span className="text-purple-400">{dailyShift.evening.worker} (VAC)</span> : `${dailyShift.evening.worker} (${dailyShift.evening.start}-${dailyShift.evening.end})`) : 'Cerrado'}</div>
                    </div>
                ) : (
                    <div className="text-xs text-gray-400">
                        <div>M: {dailyShift.morning.active ? (isMorningVacation ? <span className="text-purple-400 font-bold">{dailyShift.morning.worker} (VAC)</span> : dailyShift.morning.worker) : 'Cerrado'}</div>
                        <div>T: {dailyShift.evening.active ? (isEveningVacation ? <span className="text-purple-400 font-bold">{dailyShift.evening.worker} (VAC)</span> : dailyShift.evening.worker) : 'Cerrado'}</div>
                    </div>
                )}
            </div>
            <div className="relative bg-black/10 rounded-b-md overflow-y-auto pt-2" style={{ minHeight: `${(timelineConfig.endHour - timelineConfig.startHour + 1) * 60 * timelineConfig.pixelsPerMinute + 16}px` }} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                {timelineHours.map(hour => (
                    <div key={hour} className="absolute w-full border-b border-white/5" style={{ top: `${(hour - timelineConfig.startHour) * 60 * timelineConfig.pixelsPerMinute + 8}px` }}>
                        <span className="absolute -top-2 left-1 text-gray-500 text-[10px]">{`${hour.toString().padStart(2, '0')}:00`}</span>
                    </div>
                ))}
                
                {processedEvents.map((event) => {
                    const top = (timeToMinutes(event.startTime) - timelineConfig.startHour * 60) * timelineConfig.pixelsPerMinute;
                    const height = (timeToMinutes(event.endTime) - timeToMinutes(event.startTime)) * timelineConfig.pixelsPerMinute;
                    const isEvent = event.type === 'event';
                    const salaOnly = !isEvent && isSalaOnly(event.consolidatedBooking!);
                    
                    const { left, width, zIndex } = event.layout;

                    return (
                        <div
                            key={event.id}
                            onClick={() => isEvent ? onSelectSpecialEvent(specialEvents[event.id] as SpecialEvent) : onSelectBooking(event.consolidatedBooking!)}
                            className={`absolute p-1 rounded-md text-white text-[10px] leading-tight overflow-hidden transition-colors ${
                                isEvent 
                                    ? 'bg-purple-800/80 hover:bg-purple-700' 
                                    : salaOnly
                                        ? `bg-green-800/80 ${!isReadOnly ? 'hover:bg-green-700' : ''}`
                                        : `bg-gray-700/80 ${!isReadOnly ? 'hover:bg-gray-600' : ''}`
                            } ${!isReadOnly ? 'cursor-pointer' : 'cursor-default'}`}
                            style={{ 
                                top: `${top + 8}px`, 
                                height: `${Math.max(height - 2, 10)}px`,
                                left: `calc(2rem + (100% - 2.25rem) * ${left})`,
                                width: `calc((100% - 2.25rem) * ${width} - 2px)`,
                                zIndex: zIndex,
                             }}
                            title={event.name}
                            draggable={!isReadOnly && !isEvent}
                            onDragStart={(e) => !isReadOnly && !isEvent && handleDragStart(e, event.consolidatedBooking!)}
                            onDragEnd={!isReadOnly && !isEvent ? handleDragEnd : undefined}
                        >
                            <p className="font-bold pointer-events-none">{event.name}</p>
                            <p className="text-gray-300 pointer-events-none">{`${event.startTime} - ${event.endTime}`}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AgendaTimelineDay;