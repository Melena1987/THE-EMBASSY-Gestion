import React, { useMemo, useState } from 'react';
// FIX: Added missing 'ShiftAssignment' type import to resolve a TypeScript error.
import type { Bookings, ConsolidatedBooking, View, ShiftAssignments, ShiftAssignment, BookingDetails, SpecialEvents, SpecialEvent, Task, TaskSourceCollection } from '../types';
import { WORKERS, TIME_SLOTS } from '../constants';
import { getWeekData, formatDateForBookingKey } from '../utils/dateUtils';
import PlusIcon from './icons/PlusIcon';
import StarIcon from './icons/StarIcon';
import { consolidateBookingsForDay } from '../utils/bookingUtils';
import DownloadIcon from './icons/DownloadIcon';
import { ensurePdfLibsLoaded, generateShiftsPDF, generateAgendaPDF } from '../utils/pdfUtils';
import CheckIcon from './icons/CheckIcon';
import { getDefaultDailyShift } from '../utils/shiftUtils';

interface AgendaViewProps {
    bookings: Bookings;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onSelectBooking: (booking: ConsolidatedBooking) => void;
    setView: (view: View) => void;
    shiftAssignments: ShiftAssignments;
    specialEvents: SpecialEvents;
    onAddBooking: (bookingKeys: string[], bookingDetails: BookingDetails) => Promise<boolean>;
    onToggleTask: (sourceId: string, taskId: string, collectionName: TaskSourceCollection) => void;
    onSelectSpecialEvent: (event: SpecialEvent) => void;
    isReadOnly: boolean;
}

type CombinedTask = (Task & {
    type: 'shift';
    sourceId: string;
}) | (Task & {
    type: 'event';
    sourceId: string;
    eventName: string;
});

const timelineConfig = {
  startHour: 9, // 9 AM
  endHour: 23, // 11 PM
  pixelsPerMinute: 0.7,
};

const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const AgendaView: React.FC<AgendaViewProps> = ({ bookings, selectedDate, onDateChange, onSelectBooking, setView, shiftAssignments, specialEvents, onAddBooking, onToggleTask, onSelectSpecialEvent, isReadOnly }) => {
    const [isDownloadingShifts, setIsDownloadingShifts] = useState(false);
    const [isDownloadingAgenda, setIsDownloadingAgenda] = useState(false);

    const weekDays = useMemo(() => {
        const referenceDate = new Date(selectedDate);
        const dayOfWeek = referenceDate.getDay();
        const diffToMonday = referenceDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        const monday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), diffToMonday);
    
        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            return day;
        });
    }, [selectedDate]);

    const { week: weekNumber, year } = getWeekData(selectedDate);
    const weekId = `${year}-${weekNumber.toString().padStart(2, '0')}`;

    const defaultAssignments = useMemo(() => {
        const isEvenWeek = weekNumber % 2 === 0;
        const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
        const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
        return { morning, evening };
    }, [weekNumber]);

    // FIX: Explicitly type `currentWeekShifts` as `ShiftAssignment` to resolve type inference issues.
    const currentWeekShifts: ShiftAssignment = shiftAssignments[weekId] || defaultAssignments;

    const allTasks = useMemo(() => {
        const weeklyTasks: CombinedTask[] = (currentWeekShifts.tasks || []).map(task => ({
            ...task,
            type: 'shift',
            sourceId: weekId,
        }));
        
        const eventTasks: CombinedTask[] = [];
        const weekDateStrings = new Set(weekDays.map(d => formatDateForBookingKey(d)));

        // FIX: Explicitly cast the result of Object.values to SpecialEvent[] to resolve type inference issues where `event` was being inferred as `unknown`.
        for (const event of Object.values(specialEvents) as SpecialEvent[]) {
            if (event.tasks && event.tasks.length > 0) {
                let overlaps = false;
                for (let d = new Date(`${event.startDate}T00:00:00`); d <= new Date(`${event.endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
                    if (weekDateStrings.has(formatDateForBookingKey(d))) {
                        overlaps = true;
                        break;
                    }
                }

                if (overlaps) {
                    event.tasks.forEach(task => {
                        eventTasks.push({
                            ...task,
                            type: 'event',
                            sourceId: event.id,
                            eventName: event.name,
                        });
                    });
                }
            }
        }
        return [...weeklyTasks, ...eventTasks];
    }, [currentWeekShifts.tasks, specialEvents, weekDays, weekId]);


    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + offset * 7);
        onDateChange(newDate);
    };

    const handleDownloadShiftsPDF = async () => {
        setIsDownloadingShifts(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            // FIX: Added missing `allTasks` argument to the function call.
            await generateShiftsPDF(weekNumber, year, weekDays, currentWeekShifts, allTasks);
        }
        setIsDownloadingShifts(false);
    };

    const handleDownloadAgendaPDF = async () => {
        setIsDownloadingAgenda(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateAgendaPDF(weekNumber, year, weekDays, bookings, currentWeekShifts, specialEvents, allTasks);
        }
        setIsDownloadingAgenda(false);
    }

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
    
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetDate: Date) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        try {
            const bookingData: ConsolidatedBooking = JSON.parse(e.dataTransfer.getData('application/json'));
            if (formatDateForBookingKey(targetDate) === bookingData.date) {
                return; // Can't drop on the same day
            }
            
            const { startTime, endTime, details, keys: originalKeys } = bookingData;
            
            const spaceIds = [...new Set(originalKeys.map(key => key.split('-').slice(0, -4).join('-')))];
            const timeSlots = TIME_SLOTS.filter(time => time >= startTime && time < endTime);
            const targetDateStr = formatDateForBookingKey(targetDate);
            
            const newKeys = spaceIds.flatMap(spaceId => 
                timeSlots.map(time => `${spaceId}-${targetDateStr}-${time}`)
            );
            
            // Conflict check
            for (const key of newKeys) {
                if (bookings[key]) {
                    alert(`Conflicto de reserva: El horario de ${startTime} a ${endTime} ya está ocupado el ${targetDate.toLocaleDateString('es-ES')}.`);
                    return;
                }
            }

            await onAddBooking(newKeys, details);

        } catch (error) {
            console.error("Error al soltar la reserva:", error);
            alert("No se pudo duplicar la reserva.");
        }
    };
    
    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <div className="flex flex-col sm:flex-row items-center sm:justify-between mb-4 gap-4 sm:gap-2">
                    
                    {/* Prev button (for sm and up) */}
                    <div className="hidden sm:flex sm:flex-1 sm:justify-start">
                        <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                    </div>

                    {/* Title */}
                    <div className="flex-shrink-0 order-first sm:order-none w-full sm:w-auto text-center">
                        <h2 className="text-xl font-bold text-white">
                            Semana {weekNumber}
                        </h2>
                        <p className="text-sm font-normal text-gray-400">
                            {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    
                    {/* Mobile-only full-width nav */}
                    <div className="w-full flex justify-between items-center sm:hidden order-1">
                        <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                        <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente &gt;</button>
                    </div>

                    {/* Right side buttons */}
                    <div className="flex sm:flex-1 items-center justify-center sm:justify-end gap-2 order-last">
                        <button
                            onClick={handleDownloadAgendaPDF}
                            disabled={isDownloadingAgenda}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                            title="Descargar agenda de reservas en PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{isDownloadingAgenda ? 'Generando...' : 'PDF Agenda'}</span>
                            <span className="sm:hidden">{isDownloadingAgenda ? '...' : 'Agenda'}</span>
                        </button>
                        <button
                            onClick={handleDownloadShiftsPDF}
                            disabled={isDownloadingShifts}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                            title="Descargar horario de turnos en PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{isDownloadingShifts ? 'Generando...' : 'PDF Turnos'}</span>
                            <span className="sm:hidden">{isDownloadingShifts ? '...' : 'Turnos'}</span>
                        </button>
                        {/* Next button for sm and up */}
                        <button onClick={() => changeWeek(1)} className="hidden sm:inline-block px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente &gt;</button>
                    </div>
                </div>
            </div>

            {(allTasks.length > 0 || currentWeekShifts.observations) && (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {allTasks.length > 0 && (
                        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                            <h3 className="text-lg font-semibold text-orange-400 mb-3">Tareas de la Semana</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {allTasks.map(task => {
                                    const isEventTask = task.type === 'event';
                                    return (
                                        <div key={task.id} className="flex items-center gap-3 text-sm p-2 bg-black/20 rounded-md">
                                            {isEventTask && <StarIcon className="w-4 h-4 flex-shrink-0 text-purple-400" />}
                                            <button
                                                onClick={() => onToggleTask(
                                                    task.sourceId,
                                                    task.id,
                                                    isEventTask ? 'specialEvents' : 'shiftAssignments'
                                                )}
                                                className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors duration-200 ${
                                                    task.completed 
                                                        ? 'bg-green-500 hover:bg-green-600' 
                                                        : `border-2 ${isEventTask ? 'border-purple-400' : 'border-gray-500'} hover:bg-white/10`
                                                }`}
                                                aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                                            >
                                                {task.completed && <CheckIcon className="w-3 h-3 text-white" />}
                                            </button>
                                            <span className={`flex-grow ${task.completed ? 'line-through text-gray-500' : (isEventTask ? 'text-purple-200' : 'text-gray-200')}`}>
                                                {isEventTask && <span className="font-semibold text-purple-400 mr-1">[{task.eventName}]</span>}
                                                {task.text}
                                            </span>
                                            <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full flex-shrink-0">
                                                {Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {currentWeekShifts.observations && (
                         <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                            <h3 className="text-lg font-semibold text-orange-400 mb-3">Observaciones</h3>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto pr-2">{currentWeekShifts.observations}</p>
                         </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {weekDays.map(day => {
                    const dayKey = formatDateForBookingKey(day);
                    const dayWeekData = getWeekData(day);
                    const dayWeekId = `${dayWeekData.year}-${dayWeekData.week.toString().padStart(2, '0')}`;
                    const dayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1;
                    const dailyOverride = shiftAssignments[dayWeekId]?.dailyOverrides?.[dayIndex];
                    const dayBookings = consolidateBookingsForDay(bookings, day);
                    const eventsForDay = Object.values(specialEvents).filter((event: SpecialEvent) => dayKey >= event.startDate && dayKey <= event.endDate);
                    
                    const allDayEvents = eventsForDay.filter(e => !e.startTime || !e.endTime);
                    const timedEvents = eventsForDay.filter(e => e.startTime && e.endTime);

                    const defaultDailyShift = getDefaultDailyShift(dayIndex, currentWeekShifts.morning, currentWeekShifts.evening);
                    const effectiveShifts = dailyOverride || defaultDailyShift;

                    return (
                        <div 
                            key={day.toISOString()} 
                            className="bg-white/5 backdrop-blur-lg p-3 rounded-lg shadow-inner min-h-[200px] flex flex-col border border-white/10 transition-all duration-300"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, day)}
                        >
                            <div className="text-center border-b border-white/20 pb-2 mb-2">
                                <h3 className="font-bold capitalize text-white">
                                    {day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                </h3>
                                <div className={`text-xs mt-1 ${dailyOverride ? 'text-blue-300' : 'text-gray-400'}`} style={{ fontFamily: 'Arial, sans-serif' }}>
                                    {effectiveShifts.morning.active || effectiveShifts.evening.active ? (
                                        <>
                                            {effectiveShifts.morning.active && (
                                                <p className="leading-tight">M: {effectiveShifts.morning.worker} ({effectiveShifts.morning.start} - {effectiveShifts.morning.end})</p>
                                            )}
                                            {effectiveShifts.evening.active && (
                                                <p className="leading-tight">T: {effectiveShifts.evening.worker} ({effectiveShifts.evening.start} - {effectiveShifts.evening.end})</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-red-400 font-semibold">Cerrado</p>
                                    )}
                                </div>
                            </div>
                             <div className="flex-grow flex flex-col">
                                <div className="space-y-2 mb-2">
                                    {allDayEvents.map((event: SpecialEvent) => (
                                        <button 
                                            key={event.id}
                                            onClick={() => onSelectSpecialEvent(event)}
                                            className="w-full text-left bg-purple-800/50 p-2 rounded hover:bg-purple-700/50 transition-colors duration-200 border border-purple-400"
                                        >
                                            <p className="font-bold text-purple-200 pointer-events-none flex items-center gap-2 text-xs">
                                                <StarIcon className="w-4 h-4 flex-shrink-0" />
                                                <span className="truncate">{event.name}</span>
                                            </p>
                                        </button>
                                    ))}
                                </div>
                                <div className="relative flex-grow" style={{ minHeight: `${(timelineConfig.endHour - timelineConfig.startHour) * 60 * timelineConfig.pixelsPerMinute}px` }}>
                                    {/* FIX: Explicitly type 'event' to resolve type inference issues where its properties could not be accessed. */}
                                    {timedEvents.map((event: SpecialEvent) => {
                                        const startMinutes = timeToMinutes(event.startTime!);
                                        const endMinutes = timeToMinutes(event.endTime!);
                                        const timelineStartMinutes = timelineConfig.startHour * 60;
                                        const timelineEndMinutes = timelineConfig.endHour * 60;

                                        if (endMinutes <= timelineStartMinutes || startMinutes >= timelineEndMinutes) {
                                            return null;
                                        }

                                        const displayStartMinutes = Math.max(startMinutes, timelineStartMinutes);
                                        const displayEndMinutes = Math.min(endMinutes, timelineEndMinutes);

                                        const top = (displayStartMinutes - timelineStartMinutes) * timelineConfig.pixelsPerMinute;
                                        const height = Math.max(1, ((displayEndMinutes - displayStartMinutes) * timelineConfig.pixelsPerMinute) - 2);

                                        return (
                                            <div
                                                key={event.id}
                                                onClick={() => onSelectSpecialEvent(event)}
                                                className="absolute w-[98%] left-[1%] text-left bg-purple-800/50 p-1 rounded hover:bg-purple-700/50 transition-all duration-200 border border-purple-400 overflow-hidden flex flex-col justify-start cursor-pointer"
                                                style={{ top: `${top}px`, height: `${height}px` }}
                                                title={event.name}
                                            >
                                                <p className="font-semibold text-purple-200 pointer-events-none truncate text-[10px] leading-tight flex items-center gap-1">
                                                    <StarIcon className="w-3 h-3 flex-shrink-0" /> {event.startTime} - {event.endTime}
                                                </p>
                                                <p className="text-white pointer-events-none truncate text-[10px] leading-tight font-medium">
                                                    {event.name}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    
                                    {dayBookings.map((booking, index) => {
                                        const startMinutes = timeToMinutes(booking.startTime);
                                        const endMinutes = timeToMinutes(booking.endTime);
                                        const timelineStartMinutes = timelineConfig.startHour * 60;
                                        const timelineEndMinutes = timelineConfig.endHour * 60;

                                        if (endMinutes <= timelineStartMinutes || startMinutes >= timelineEndMinutes) {
                                            return null;
                                        }
                                        
                                        const displayStartMinutes = Math.max(startMinutes, timelineStartMinutes);
                                        const displayEndMinutes = Math.min(endMinutes, timelineEndMinutes);

                                        const top = (displayStartMinutes - timelineStartMinutes) * timelineConfig.pixelsPerMinute;
                                        const height = Math.max(1, ((displayEndMinutes - displayStartMinutes) * timelineConfig.pixelsPerMinute) - 2);

                                        return (
                                            <div 
                                                key={index} 
                                                draggable={!isReadOnly}
                                                onDragStart={(e) => !isReadOnly && handleDragStart(e, booking)}
                                                onDragEnd={!isReadOnly ? handleDragEnd : undefined}
                                                onClick={() => onSelectBooking(booking)}
                                                className={`absolute w-[98%] left-[1%] text-left bg-black/30 p-1 rounded hover:bg-black/40 transition-all duration-200 border border-transparent hover:border-orange-500 overflow-hidden flex flex-col justify-start ${!isReadOnly ? 'cursor-grab' : 'cursor-default'}`}
                                                style={{ top: `${top}px`, height: `${height}px` }}
                                            >
                                                <p className="font-semibold text-orange-400 pointer-events-none truncate text-[10px] leading-tight">
                                                    {booking.startTime} - {booking.endTime}
                                                </p>
                                                <p className="text-white pointer-events-none truncate text-[10px] leading-tight font-medium">
                                                    {booking.details.name}
                                                </p>
                                                <p className="capitalize text-gray-300 pointer-events-none truncate text-[9px] leading-tight">
                                                    {booking.space}
                                                </p>
                                            </div>
                                        );
                                    })}
                                     
                                    {dayBookings.length === 0 && timedEvents.length === 0 && allDayEvents.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center text-xs">
                                            <p>Sin actividad</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                             <div className="flex justify-center pt-2 mt-auto">
                                {!isReadOnly && (
                                    <button 
                                        onClick={() => { onDateChange(day); setView('plano'); }}
                                        className="bg-black/20 hover:bg-black/40 text-orange-400 p-2 rounded-full transition-colors"
                                        aria-label={`Añadir reserva para ${day.toLocaleDateString('es-ES')}`}
                                        title={"Añadir reserva"}
                                    >
                                        <PlusIcon className="w-6 h-6" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AgendaView;