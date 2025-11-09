import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { Bookings, ConsolidatedBooking, View, ShiftAssignments, ShiftAssignment, BookingDetails, SpecialEvents, SpecialEvent, Task, TaskSourceCollection, UserRole, Vacations } from '../../types';
import { WORKERS } from '../../constants';
import { getWeekData, formatDateForBookingKey } from '../../utils/dateUtils';
import PlusIcon from '../icons/PlusIcon';
import StarIcon from '../icons/StarIcon';
import AgendaHeader from './agenda/AgendaHeader';
import AgendaTasksObservations from './agenda/AgendaTasksObservations';
import AgendaTimelineDay from './agenda/AgendaTimelineDay';
import { consolidateBookingsForDay } from '../../utils/bookingUtils';

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
    onUpdateShifts: (weekId: string, newShifts: ShiftAssignment, oldShifts: ShiftAssignment | undefined) => void;
    currentUserName: string | null;
    userRole: UserRole;
    vacations: Vacations;
}

type CombinedTask = (Task & {
    type: 'shift';
    sourceId: string;
}) | (Task & {
    type: 'event';
    sourceId: string;
    eventName: string;
});

const AgendaView: React.FC<AgendaViewProps> = (props) => {
    const { 
        bookings, selectedDate, onDateChange, onSelectBooking, setView, 
        shiftAssignments, specialEvents, onAddBooking, onToggleTask, 
        onSelectSpecialEvent, isReadOnly, onUpdateShifts, 
        currentUserName, userRole, vacations 
    } = props;
    
    const [areFabsVisible, setAreFabsVisible] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const scrollThreshold = 100;

            if (currentScrollY > lastScrollY.current && currentScrollY > scrollThreshold) {
                setAreFabsVisible(false);
            } else {
                setAreFabsVisible(true);
            }
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
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
        let earliestHour = 9;
        weekDays.forEach(day => {
            const dayKey = formatDateForBookingKey(day);
            const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);
            const dayBookings = consolidateBookingsForDay(bookings, day);

            const timedItems = [
                ...(eventsForDay as SpecialEvent[]).filter(e => e.startTime).map(e => ({ startTime: e.startTime! })),
                ...dayBookings.map(b => ({ startTime: b.startTime }))
            ];
            timedItems.forEach(item => {
                const hour = parseInt(item.startTime.split(':')[0], 10);
                if (hour < earliestHour) earliestHour = hour;
            });
        });
        return { startHour: earliestHour, endHour: 23, pixelsPerMinute: 0.7 };
    }, [weekDays, bookings, specialEvents]);

    const defaultAssignments = useMemo(() => {
        const isEvenWeek = weekNumber % 2 === 0;
        const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
        const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
        return { morning, evening };
    }, [weekNumber]);

    const currentWeekShifts = shiftAssignments[weekId];
    
    const resolvedShifts = useMemo(() => ({
        ...defaultAssignments,
        ...(currentWeekShifts || {}),
    }), [defaultAssignments, currentWeekShifts]);
    
    const getResolvedAssignees = useCallback((task: CombinedTask): string[] => {
        if (task.type !== 'shift') {
            const assignees = task.assignedTo;
            return Array.isArray(assignees) ? assignees : (assignees ? [assignees] : []);
        }
        const finalAssignees = new Set<string>();
        const taskAssignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
        
        taskAssignees.forEach(a => {
            if (a === 'MAÑANA') finalAssignees.add(resolvedShifts.morning);
            else if (a === 'TARDE') finalAssignees.add(resolvedShifts.evening);
            else if (a) finalAssignees.add(a);
        });
        return Array.from(finalAssignees);
    }, [resolvedShifts]);

    const allTasks = useMemo(() => {
        const weeklyTasks: CombinedTask[] = (currentWeekShifts?.tasks || []).map(task => ({ ...task, type: 'shift', sourceId: weekId }));
        const eventTasks: CombinedTask[] = [];
        const weekDateStrings = new Set(weekDays.map(d => formatDateForBookingKey(d)));

        for (const event of Object.values(specialEvents)) {
            const typedEvent = event as SpecialEvent;
            if (typedEvent.tasks?.length > 0) {
                let overlaps = false;
                for (let d = new Date(`${typedEvent.startDate}T00:00:00`); d <= new Date(`${typedEvent.endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
                    if (weekDateStrings.has(formatDateForBookingKey(d))) {
                        overlaps = true;
                        break;
                    }
                }
                if (overlaps) {
                    typedEvent.tasks.forEach(task => eventTasks.push({ ...task, type: 'event', sourceId: typedEvent.id, eventName: typedEvent.name }));
                }
            }
        }
        return [...weeklyTasks, ...eventTasks];
    }, [currentWeekShifts?.tasks, specialEvents, weekDays, weekId]);

    const canAddObservations = userRole === 'ADMIN' || userRole === 'EVENTOS' || userRole === 'TRABAJADOR';

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <AgendaHeader 
                selectedDate={selectedDate}
                onDateChange={onDateChange}
                weekNumber={weekNumber}
                year={year}
                weekDays={weekDays}
                bookings={bookings}
                currentWeekShifts={currentWeekShifts}
                defaultAssignments={defaultAssignments}
                specialEvents={specialEvents}
                allTasks={allTasks}
                vacations={vacations}
            />

            <AgendaTasksObservations 
                allTasks={allTasks}
                onToggleTask={onToggleTask}
                getResolvedAssignees={getResolvedAssignees}
                currentWeekShifts={currentWeekShifts}
                canAddObservations={canAddObservations}
                onUpdateShifts={(weekId, newShifts) => onUpdateShifts(weekId, newShifts, currentWeekShifts)}
                weekId={weekId}
                defaultAssignments={defaultAssignments}
                currentUserName={currentUserName}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {weekDays.map((day, dayIndex) => (
                    <AgendaTimelineDay
                        key={day.toISOString()}
                        day={day}
                        dayIndex={dayIndex}
                        bookings={bookings}
                        specialEvents={specialEvents}
                        currentWeekShifts={currentWeekShifts}
                        defaultAssignments={defaultAssignments}
                        vacations={vacations}
                        timelineConfig={timelineConfig}
                        onSelectSpecialEvent={onSelectSpecialEvent}
                        onSelectBooking={onSelectBooking}
                        onAddBooking={onAddBooking}
                        isReadOnly={isReadOnly}
                    />
                ))}
            </div>

            {!isReadOnly && (
                 <div className={`fixed bottom-24 right-6 z-40 flex flex-col items-center gap-3 transition-transform duration-300 ease-in-out md:bottom-6 ${areFabsVisible ? 'translate-y-0' : 'translate-y-40'}`}>
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