import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Bookings, ConsolidatedBooking, View, ShiftAssignments, ShiftAssignment, BookingDetails, SpecialEvents, SpecialEvent, Task, TaskSourceCollection, UserRole } from '../../types';
import { WORKERS, TIME_SLOTS } from '../../constants';
import { getWeekData, formatDateForBookingKey } from '../../utils/dateUtils';
import PlusIcon from '../icons/PlusIcon';
import StarIcon from '../icons/StarIcon';
import { consolidateBookingsForDay } from '../../utils/bookingUtils';
import DownloadIcon from '../icons/DownloadIcon';
import { ensurePdfLibsLoaded, generateShiftsPDF, generateAgendaPDF } from '../../utils/pdfUtils';
import CheckIcon from '../icons/CheckIcon';
import { getDefaultDailyShift } from '../../utils/shiftUtils';

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
    onUpdateShifts: (weekId: string, newShifts: ShiftAssignment) => void;
    currentUserName: string | null;
    userRole: UserRole;
}

type CombinedTask = (Task & {
    type: 'shift';
    sourceId: string;
}) | (Task & {
    type: 'event';
    sourceId: string;
    eventName: string;
});

const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const AgendaView: React.FC<AgendaViewProps> = ({ bookings, selectedDate, onDateChange, onSelectBooking, setView, shiftAssignments, specialEvents, onAddBooking, onToggleTask, onSelectSpecialEvent, isReadOnly, onUpdateShifts, currentUserName, userRole }) => {
    const [isDownloadingShifts, setIsDownloadingShifts] = useState(false);
    const [isDownloadingAgenda, setIsDownloadingAgenda] = useState(false);
    const [showCompletedTasks, setShowCompletedTasks] = useState(false);
    const [newObservationText, setNewObservationText] = useState('');
    const [areFabsVisible, setAreFabsVisible] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const scrollThreshold = 100; // Only start hiding after scrolling 100px down

            if (currentScrollY > lastScrollY.current && currentScrollY > scrollThreshold) {
                // Scrolling down
                setAreFabsVisible(false);
            } else {
                // Scrolling up or at the top
                setAreFabsVisible(true);
            }
            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

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

    const timelineConfig = useMemo(() => {
        let earliestHour = 9; // Default start hour

        weekDays.forEach(day => {
            const dayKey = formatDateForBookingKey(day);
            const dayBookings = consolidateBookingsForDay(bookings, day);
            const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);

            const timedItems = [
                ...(eventsForDay as SpecialEvent[]).filter(e => e.startTime).map(e => ({ startTime: e.startTime! })),
                ...dayBookings.map(b => ({ startTime: b.startTime }))
            ];

            timedItems.forEach(item => {
                const hour = parseInt(item.startTime.split(':')[0], 10);
                if (hour < earliestHour) {
                    earliestHour = hour;
                }
            });
        });

        return {
            startHour: earliestHour,
            endHour: 23,
            pixelsPerMinute: 0.7,
        };
    }, [weekDays, bookings, specialEvents]);

    const defaultAssignments = useMemo(() => {
        const isEvenWeek = weekNumber % 2 === 0;
        const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
        const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
        return { morning, evening };
    }, [weekNumber]);

    const currentWeekShifts = shiftAssignments[weekId];
    const canAddObservations = userRole === 'ADMIN' || userRole === 'EVENTOS' || userRole === 'TRABAJADOR';

    const handleAddObservation = () => {
        if (!newObservationText.trim() || !currentUserName) return;

        const baseShifts = shiftAssignments[weekId] || {
            morning: defaultAssignments.morning,
            evening: defaultAssignments.evening,
        };

        const today = new Date();
        const dateStamp = today.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

        const observationLine = `\n- [${dateStamp}] ${currentUserName}: ${newObservationText.trim()}`;
        const existingObservations = baseShifts.observations || '';
        const updatedObservations = (existingObservations ? existingObservations.trim() : '') + observationLine;
        
        const updatedShifts: ShiftAssignment = {
            ...baseShifts,
            observations: updatedObservations
        };

        onUpdateShifts(weekId, updatedShifts);
        setNewObservationText('');
    };

    const allTasks = useMemo(() => {
        const weeklyTasks: CombinedTask[] = (currentWeekShifts?.tasks || []).map(task => ({
            ...task,
            type: 'shift',
            sourceId: weekId,
        }));
        
        const eventTasks: CombinedTask[] = [];
        const weekDateStrings = new Set(weekDays.map(d => formatDateForBookingKey(d)));

        for (const event of Object.values(specialEvents)) {
            const typedEvent = event as SpecialEvent;
            if (typedEvent.tasks && typedEvent.tasks.length > 0) {
                let overlaps = false;
                for (let d = new Date(`${typedEvent.startDate}T00:00:00`); d <= new Date(`${typedEvent.endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
                    if (weekDateStrings.has(formatDateForBookingKey(d))) {
                        overlaps = true;
                        break;
                    }
                }

                if (overlaps) {
                    typedEvent.tasks.forEach(task => {
                        eventTasks.push({
                            ...task,
                            type: 'event',
                            sourceId: typedEvent.id,
                            eventName: typedEvent.name,
                        });
                    });
                }
            }
        }
        return [...weeklyTasks, ...eventTasks];
    }, [currentWeekShifts?.tasks, specialEvents, weekDays, weekId]);

    const completedTasks = useMemo(() => allTasks.filter(task => task.completed), [allTasks]);
    const tasksToDisplay = useMemo(() => {
        if (showCompletedTasks) {
            return [...allTasks.filter(t => !t.completed), ...completedTasks];
        }
        return allTasks.filter(task => !task.completed);
    }, [allTasks, showCompletedTasks, completedTasks]);

    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + offset * 7);
        onDateChange(newDate);
    };

    const handleDownloadShiftsPDF = async () => {
        setIsDownloadingShifts(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateShiftsPDF(weekNumber, year, weekDays, currentWeekShifts || defaultAssignments, allTasks);
        }
        setIsDownloadingShifts(false);
    };

    const handleDownloadAgendaPDF = async () => {
        setIsDownloadingAgenda(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateAgendaPDF(weekNumber, year, weekDays, bookings, currentWeekShifts || defaultAssignments, specialEvents, allTasks);
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
                    
                    <div className="hidden sm:flex sm:flex-1 sm:justify-start">
                        <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                    </div>

                    <div className="flex-shrink-0 order-first sm:order-none w-full sm:w-auto text-center">
                        <h2 className="text-xl font-bold text-white">
                            Semana {weekNumber}
                        </h2>
                        <p className="text-sm font-normal text-gray-400">
                            {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    
                    <div className="w-full flex justify-between items-center sm:hidden order-1">
                        <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Ant</button>
                        <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Sig &gt;</button>
                    </div>

                    <div className="hidden sm:flex sm:flex-1 sm:justify-end items-center gap-2">
                         <button
                            onClick={handleDownloadAgendaPDF}
                            disabled={isDownloadingAgenda}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                            title="Descargar agenda semanal en PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden lg:inline">{isDownloadingAgenda ? 'Generando...' : 'PDF Agenda'}</span>
                        </button>
                        <button
                            onClick={handleDownloadShiftsPDF}
                            disabled={isDownloadingShifts}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                            title="Descargar horario de turnos en PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden lg:inline">{isDownloadingShifts ? 'Generando...' : 'PDF Turnos'}</span>
                        </button>
                        <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente Semana &gt;</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-orange-400">Tareas de la Semana</h3>
                        {completedTasks.length > 0 && (
                            <button
                                onClick={() => setShowCompletedTasks(prev => !prev)}
                                className="text-sm text-gray-400 hover:text-white underline focus:outline-none"
                            >
                                {showCompletedTasks ? 'Ocultar completadas' : `Mostrar ${completedTasks.length} completada${completedTasks.length > 1 ? 's' : ''}`}
                            </button>
                        )}
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {allTasks.length > 0 ? (
                            tasksToDisplay.length > 0 ? (
                                tasksToDisplay.map(task => {
                                    const isEventTask = task.type === 'event';
                                    const assignees = task.assignedTo ? (Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo]) : [];
                                    return (
                                        <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
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
                                            <div className="flex-grow text-sm">
                                                {isEventTask && <span className="font-semibold text-purple-400 mr-1">[{task.eventName}]</span>}
                                                <span className={`${task.completed ? 'line-through text-gray-500' : (isEventTask ? 'text-purple-200' : 'text-gray-200')}`}>
                                                    {task.text}
                                                </span>
                                            </div>
                                            {assignees.length > 0 && (
                                                <div className="flex-shrink-0 flex items-center flex-wrap gap-1 justify-end">
                                                    {assignees.map(assignee => (
                                                        assignee && (
                                                            <span key={assignee} className="bg-blue-900/70 text-blue-300 text-xs font-semibold px-2 py-1 rounded-full">
                                                                {assignee}
                                                            </span>
                                                        )
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-2">Todas las tareas están completadas. ¡Bien hecho!</p>
                            )
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-2">No hay tareas para esta semana.</p>
                        )}
                    </div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                    <h3 className="text-lg font-semibold text-orange-400 mb-2">Observaciones de Turnos</h3>
                    <div className="bg-black/20 p-3 rounded-md min-h-[100px] max-h-[250px] overflow-y-auto">
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">
                            {currentWeekShifts?.observations || 'No hay observaciones para esta semana.'}
                        </p>
                    </div>
                     {canAddObservations && (
                        <div className="mt-3 space-y-2">
                            <textarea
                                value={newObservationText}
                                onChange={(e) => setNewObservationText(e.target.value)}
                                rows={2}
                                placeholder="Añadir una nueva observación..."
                                className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 resize-y"
                            />
                            <button
                                onClick={handleAddObservation}
                                disabled={!newObservationText.trim()}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Añadir Observación
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {weekDays.map((day, dayIndex) => {
                    const dayKey = formatDateForBookingKey(day);
                    const dayBookings = consolidateBookingsForDay(bookings, day);
                    const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);
                    const dailyShift = currentWeekShifts?.dailyOverrides?.[dayIndex] || getDefaultDailyShift(dayIndex, currentWeekShifts?.morning || defaultAssignments.morning, currentWeekShifts?.evening || defaultAssignments.evening);
                    const isSpecialShift = !!currentWeekShifts?.dailyOverrides?.[dayIndex];

                    const timelineHours = Array.from({ length: timelineConfig.endHour - timelineConfig.startHour + 1 }, (_, i) => timelineConfig.startHour + i);
                    
                    const timedEvents = [
                        ...(eventsForDay as SpecialEvent[]).map(event => ({
                            type: 'event' as const,
                            id: event.id,
                            name: event.name,
                            startTime: event.startTime!,
                            endTime: event.endTime!,
                            spaceIds: event.spaceIds || [],
                        })),
                        ...dayBookings.map(booking => ({
                            type: 'booking' as const,
                            id: booking.keys.join('-'),
                            name: booking.details.name,
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            spaceIds: booking.keys.map(k => k.split('-').slice(0, -4).join('-')),
                            consolidatedBooking: booking,
                        }))
                    ].filter(e => e.startTime && e.endTime);

                    return (
                        <div key={day.toISOString()} className="bg-white/5 backdrop-blur-lg rounded-lg shadow-inner border border-white/10">
                            <div className="p-3 border-b border-white/20 text-center">
                                <h3 className="font-bold capitalize text-white">{day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</h3>
                                {isSpecialShift ? (
                                    <div className="text-xs text-blue-300 font-semibold" title="Horario especial para este día">
                                        <span>
                                            M: {dailyShift.morning.active 
                                                ? `${dailyShift.morning.worker} (${dailyShift.morning.start}-${dailyShift.morning.end})` 
                                                : 'Cerrado'}
                                        </span> | <span>
                                            T: {dailyShift.evening.active 
                                                ? `${dailyShift.evening.worker} (${dailyShift.evening.start}-${dailyShift.evening.end})`
                                                : 'Cerrado'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-400">
                                        <span>M: {dailyShift.morning.active ? dailyShift.morning.worker : 'Cerrado'}</span> | <span>T: {dailyShift.evening.active ? dailyShift.evening.worker : 'Cerrado'}</span>
                                    </div>
                                )}
                            </div>
                            <div className="relative bg-black/10 rounded-b-md overflow-y-auto pt-2" style={{ minHeight: `${(timelineConfig.endHour - timelineConfig.startHour + 1) * 60 * timelineConfig.pixelsPerMinute + 16}px` }} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, day)}>
                                {timelineHours.map(hour => (
                                    <div key={hour} className="absolute w-full border-b border-white/5" style={{ top: `${(hour - timelineConfig.startHour) * 60 * timelineConfig.pixelsPerMinute + 8}px` }}>
                                        <span className="absolute -top-2 left-1 text-gray-500 text-[10px]">{`${hour.toString().padStart(2, '0')}:00`}</span>
                                    </div>
                                ))}
                                
                                {timedEvents.map((event) => {
                                    const top = (timeToMinutes(event.startTime) - timelineConfig.startHour * 60) * timelineConfig.pixelsPerMinute;
                                    const height = (timeToMinutes(event.endTime) - timeToMinutes(event.startTime)) * timelineConfig.pixelsPerMinute;
                                    const isEvent = event.type === 'event';
                                    
                                    return (
                                        <div
                                            key={event.id}
                                            onClick={() => isEvent ? onSelectSpecialEvent(specialEvents[event.id] as SpecialEvent) : onSelectBooking(event.consolidatedBooking!)}
                                            className={`absolute left-8 right-1 p-1 rounded-md text-white text-[10px] leading-tight overflow-hidden transition-colors ${
                                                isEvent ? 'bg-purple-800/80 hover:bg-purple-700' : `bg-gray-700/80 ${!isReadOnly ? 'hover:bg-gray-600' : ''}`
                                            } ${!isReadOnly ? 'cursor-pointer' : 'cursor-default'}`}
                                            style={{ top: `${top + 8}px`, height: `${Math.max(height - 2, 10)}px` }}
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
                })}
            </div>

            {!isReadOnly && (
                 <div className={`fixed bottom-6 right-6 z-10 flex flex-col items-center gap-3 transition-transform duration-300 ease-in-out ${areFabsVisible ? 'translate-y-0' : 'translate-y-40'}`}>
                     <button onClick={() => setView('eventos')} className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-lg transform hover:scale-110 transition-transform" title="Añadir Evento Especial">
                        <StarIcon className="w-6 h-6"/>
                    </button>
                    <button onClick={() => setView('plano')} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full p-4 shadow-lg transform hover:scale-110 transition-transform" title="Añadir Reserva">
                        <PlusIcon className="w-6 h-6"/>
                    </button>
                </div>
            )}
        </div>
    );
};

export default AgendaView;