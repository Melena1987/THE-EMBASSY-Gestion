import React, { useMemo, useCallback } from 'react';
import type { ShiftAssignments, ShiftAssignment, ShiftPeriodDetail, Task, SpecialEvents, SpecialEvent, TaskSourceCollection, Vacations, UserRole } from '../../types';
import { WORKERS } from '../../constants';
import { getWeekData, formatDateForBookingKey } from '../../utils/dateUtils';
import { calculateUpdatedShifts } from '../../utils/shiftUtils';
import ShiftHeader from './shifts/ShiftHeader';
import DailyShiftCard from './shifts/DailyShiftCard';
import WeeklyTasksSection from './shifts/WeeklyTasksSection';
import WeeklyObservationsSection from './shifts/WeeklyObservationsSection';
import VacationManagementSection from './shifts/VacationManagementSection';

interface ShiftsViewProps {
    shiftAssignments: ShiftAssignments;
    specialEvents: SpecialEvents;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onUpdateShifts: (weekId: string, newShifts: ShiftAssignment) => void;
    onAddRecurringTask: (taskDetails: Omit<Task, 'id' | 'completed' | 'recurrenceId'>, weekIds: string[]) => Promise<boolean>;
    onToggleTask: (sourceId: string, taskId: string, collectionName: TaskSourceCollection) => void;
    onResetWeekShifts: (weekId: string) => void;
    isReadOnly: boolean;
    vacations: Vacations;
    handleUpdateVacations: (year: string, dates: Record<string, string>) => Promise<void>;
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

const ShiftsView: React.FC<ShiftsViewProps> = ({
    shiftAssignments, specialEvents, selectedDate, onDateChange, onUpdateShifts,
    onAddRecurringTask, onToggleTask, onResetWeekShifts, isReadOnly, vacations,
    handleUpdateVacations, currentUserName, userRole
}) => {
    
    const { week: weekNumber, year } = getWeekData(selectedDate);
    const weekId = `${year}-${weekNumber.toString().padStart(2, '0')}`;

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

    const defaultAssignments = useMemo(() => {
        const isEvenWeek = weekNumber % 2 === 0;
        const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
        const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
        return { morning, evening };
    }, [weekNumber]);

    const currentShifts: ShiftAssignment = { ...defaultAssignments, ...(shiftAssignments[weekId] || {}) };
    const isCustomized = !!shiftAssignments[weekId];

    const allTasks = useMemo<CombinedTask[]>(() => {
        const weeklyTasks: CombinedTask[] = (currentShifts.tasks || []).map(task => ({
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
    }, [currentShifts.tasks, specialEvents, weekDays, weekId]);

    const handleSwap = () => {
        const newShifts = {
            ...currentShifts,
            morning: currentShifts.evening,
            evening: currentShifts.morning,
        };
        onUpdateShifts(weekId, newShifts);
    };

    const handleReset = () => {
        onResetWeekShifts(weekId);
    };
    
    const handleWeeklyWorkerChange = (shift: 'morning' | 'evening', worker: string) => {
        const newShifts = { ...currentShifts };
        if (shift === 'morning') {
            newShifts.morning = worker;
            if (worker === newShifts.evening) {
                newShifts.evening = WORKERS.find(w => w !== worker) || '';
            }
        } else {
            newShifts.evening = worker;
            if (worker === newShifts.morning) {
                newShifts.morning = WORKERS.find(w => w !== worker) || '';
            }
        }
        onUpdateShifts(weekId, newShifts);
    };
    
    const handleDailyShiftChange = (dayIndex: number, period: 'morning' | 'evening', field: keyof ShiftPeriodDetail, value: string | boolean) => {
        const baseShifts: ShiftAssignment = shiftAssignments[weekId] || { 
            morning: defaultAssignments.morning, 
            evening: defaultAssignments.evening 
        };
        
        const newShifts = calculateUpdatedShifts(
            baseShifts,
            dayIndex,
            period,
            field,
            value
        );

        onUpdateShifts(weekId, newShifts);
    };

    const handleResetDay = (dayIndex: number) => {
        if (!currentShifts.dailyOverrides?.[dayIndex]) return;

        const newShifts: ShiftAssignment = structuredClone(currentShifts);
        delete newShifts.dailyOverrides[dayIndex];

        if (Object.keys(newShifts.dailyOverrides).length === 0) {
            delete newShifts.dailyOverrides;
        }
        onUpdateShifts(weekId, newShifts);
    };

    const handleObservationsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newShifts: ShiftAssignment = { ...currentShifts };
        const newObservations = e.target.value;

        if (newObservations) {
            newShifts.observations = newObservations;
        } else {
            delete newShifts.observations;
        }

        onUpdateShifts(weekId, newShifts);
    };

    const handleDeleteTask = (taskId: string) => {
        const newTasks = currentShifts.tasks?.filter(task => task.id !== taskId);
        
        const newShifts: ShiftAssignment = { ...currentShifts };
        if (newTasks && newTasks.length > 0) {
            newShifts.tasks = newTasks;
        } else {
            delete newShifts.tasks;
        }
        onUpdateShifts(weekId, newShifts);
    };
    
    const getResolvedAssignees = useCallback((task: CombinedTask): string[] => {
        if (task.type !== 'shift') {
            return Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
        }
        const assignees = new Set<string>();
        const taskAssignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
        taskAssignees.forEach(a => {
            if (a === 'MAÑANA') {
                assignees.add(currentShifts.morning);
            } else if (a === 'TARDE') {
                assignees.add(currentShifts.evening);
            } else if(a) {
                assignees.add(a);
            }
        });
        return Array.from(assignees);
    }, [currentShifts]);

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <ShiftHeader
                selectedDate={selectedDate}
                onDateChange={onDateChange}
                weekNumber={weekNumber}
                year={year}
                weekDays={weekDays}
                currentShifts={currentShifts}
                isCustomized={isCustomized}
                isReadOnly={isReadOnly}
                onWeeklyWorkerChange={handleWeeklyWorkerChange}
                onSwap={handleSwap}
                onReset={handleReset}
                allTasks={allTasks}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {weekDays.map((day, dayIndex) => (
                    <DailyShiftCard
                        key={day.toISOString()}
                        day={day}
                        dayIndex={dayIndex}
                        currentShifts={currentShifts}
                        isReadOnly={isReadOnly}
                        vacations={vacations}
                        onDailyShiftChange={handleDailyShiftChange}
                        onResetDay={handleResetDay}
                    />
                ))}
            </div>

            <WeeklyTasksSection
                allTasks={allTasks}
                isReadOnly={isReadOnly}
                currentShifts={currentShifts}
                onToggleTask={onToggleTask}
                onDeleteTask={handleDeleteTask}
                onAddTask={onAddRecurringTask}
                selectedDate={selectedDate}
                weekDays={weekDays}
                getResolvedAssignees={getResolvedAssignees}
            />
            
            <WeeklyObservationsSection
                observations={currentShifts.observations}
                isReadOnly={isReadOnly}
                onObservationsChange={handleObservationsChange}
            />

            <VacationManagementSection
                selectedDate={selectedDate}
                vacations={vacations}
                userRole={userRole}
                currentUserName={currentUserName}
                isReadOnly={isReadOnly}
                handleUpdateVacations={handleUpdateVacations}
            />
        </div>
    );
};

export default ShiftsView;
