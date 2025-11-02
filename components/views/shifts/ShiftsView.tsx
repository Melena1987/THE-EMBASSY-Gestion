import React, { useMemo, useCallback, useState, useEffect } from 'react';
import type { ShiftAssignments, ShiftAssignment, ShiftPeriodDetail, Task, SpecialEvents, SpecialEvent, TaskSourceCollection, Vacations, UserRole } from '../../../types';
import { WORKERS } from '../../../constants';
import { getWeekData, formatDateForBookingKey } from '../../../utils/dateUtils';
import { calculateUpdatedShifts } from '../../../utils/shiftUtils';
import { ensurePdfLibsLoaded, generateVacationPDF } from '../../../utils/pdfUtils';
import ShiftHeader from './ShiftHeader';
import DailyShiftCard from './DailyShiftCard';
import WeeklyTasksSection from './WeeklyTasksSection';
import WeeklyObservationsSection from './WeeklyObservationsSection';
import VacationManagementSection from './VacationManagementSection';

interface ShiftsViewProps {
    shiftAssignments: ShiftAssignments;
    specialEvents: SpecialEvents;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onUpdateShifts: (weekId: string, newShifts: ShiftAssignment, oldShifts: ShiftAssignment | undefined) => void;
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

    const currentShifts: ShiftAssignment = useMemo(() => ({ ...defaultAssignments, ...(shiftAssignments[weekId] || {}) }), [defaultAssignments, shiftAssignments, weekId]);
    const isCustomized = !!shiftAssignments[weekId];

    const [editingShifts, setEditingShifts] = useState<ShiftAssignment>(currentShifts);

    useEffect(() => {
        setEditingShifts(currentShifts);
    }, [currentShifts]);

    const isDirty = useMemo(() => {
        return JSON.stringify(currentShifts) !== JSON.stringify(editingShifts);
    }, [currentShifts, editingShifts]);
    
    const allTasks = useMemo<CombinedTask[]>(() => {
        const weeklyTasks: CombinedTask[] = (editingShifts.tasks || []).map(task => ({
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
    }, [editingShifts.tasks, specialEvents, weekDays, weekId]);

    const handleSwap = () => {
        setEditingShifts(prev => ({
            ...prev,
            morning: prev.evening,
            evening: prev.morning,
        }));
    };
    
    const handleWeeklyWorkerChange = (shift: 'morning' | 'evening', worker: string) => {
        setEditingShifts(prev => {
            const newShifts = { ...prev };
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
            return newShifts;
        });
    };
    
    const handleDailyShiftChange = (dayIndex: number, period: 'morning' | 'evening', field: keyof ShiftPeriodDetail, value: string | boolean) => {
        setEditingShifts(prev => calculateUpdatedShifts(prev, dayIndex, period, field, value));
    };

    const handleResetDay = (dayIndex: number) => {
        setEditingShifts(prev => {
            if (!prev.dailyOverrides?.[dayIndex]) return prev;

            const newShifts: ShiftAssignment = structuredClone(prev);
            delete newShifts.dailyOverrides[dayIndex];

            if (Object.keys(newShifts.dailyOverrides).length === 0) {
                delete newShifts.dailyOverrides;
            }
            return newShifts;
        });
    };

    const handleObservationsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newObservations = e.target.value;
        setEditingShifts(prev => {
            const newShifts: ShiftAssignment = { ...prev };
            if (newObservations) {
                newShifts.observations = newObservations;
            } else {
                delete newShifts.observations;
            }
            return newShifts;
        });
    };

    const handleAddSingleTask = (taskDetails: Omit<Task, 'id' | 'completed' | 'recurrenceId'>) => {
        setEditingShifts(prev => {
            const newTask: Task = {
                ...taskDetails,
                id: Date.now().toString(),
                completed: false,
            };
            const updatedTasks = [...(prev.tasks || []), newTask];
            return { ...prev, tasks: updatedTasks };
        });
    };

    const handleDeleteTask = (taskId: string) => {
        setEditingShifts(prev => {
            const newTasks = prev.tasks?.filter(task => task.id !== taskId);
            
            const newShifts: ShiftAssignment = { ...prev };
            if (newTasks && newTasks.length > 0) {
                newShifts.tasks = newTasks;
            } else {
                delete newShifts.tasks;
            }
            return newShifts;
        });
    };
    
    const getResolvedAssignees = useCallback((task: CombinedTask): string[] => {
        if (task.type !== 'shift') {
            return Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
        }
        const assignees = new Set<string>();
        const taskAssignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
        taskAssignees.forEach(a => {
            if (a === 'MAÑANA') {
                assignees.add(editingShifts.morning);
            } else if (a === 'TARDE') {
                assignees.add(editingShifts.evening);
            } else if(a) {
                assignees.add(a);
            }
        });
        return Array.from(assignees);
    }, [editingShifts]);
    
    const handleDownloadVacationPDF = async () => {
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateVacationPDF(selectedDate, vacations);
        }
    };

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <ShiftHeader
                selectedDate={selectedDate}
                onDateChange={onDateChange}
                weekNumber={weekNumber}
                year={year}
                weekDays={weekDays}
                currentShifts={editingShifts}
                isCustomized={isCustomized}
                isReadOnly={isReadOnly}
                onWeeklyWorkerChange={handleWeeklyWorkerChange}
                onSwap={handleSwap}
                onReset={() => onResetWeekShifts(weekId)}
                allTasks={allTasks}
                onDownloadVacationPDF={handleDownloadVacationPDF}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {weekDays.map((day, dayIndex) => (
                    <DailyShiftCard
                        key={day.toISOString()}
                        day={day}
                        dayIndex={dayIndex}
                        currentShifts={editingShifts}
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
                onToggleTask={onToggleTask}
                onDeleteTask={handleDeleteTask}
                onAddSingleTask={handleAddSingleTask}
                onAddRecurringTask={onAddRecurringTask}
                selectedDate={selectedDate}
                weekDays={weekDays}
                getResolvedAssignees={getResolvedAssignees}
            />
            
            <WeeklyObservationsSection
                observations={editingShifts.observations}
                isReadOnly={isReadOnly}
                onObservationsChange={handleObservationsChange}
            />

            <VacationManagementSection
                selectedDate={selectedDate}
                vacations={vacations}
                userRole={userRole}
                currentUserName={currentUserName}
                handleUpdateVacations={handleUpdateVacations}
            />

            {isDirty && !isReadOnly && (
                <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-white/20 p-4 shadow-lg z-20 flex justify-center items-center gap-4">
                    <p className="text-yellow-400 font-semibold">Tienes cambios sin guardar.</p>
                    <button
                        onClick={() => setEditingShifts(currentShifts)}
                        className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        Descartar
                    </button>
                    <button
                        onClick={() => onUpdateShifts(weekId, editingShifts, currentShifts)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        Guardar Cambios
                    </button>
                </div>
            )}
        </div>
    );
};

export default ShiftsView;