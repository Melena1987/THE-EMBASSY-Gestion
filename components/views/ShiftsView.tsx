import React, { useMemo, useState, useEffect } from 'react';
import type { ShiftAssignments, ShiftAssignment, DailyShift, ShiftPeriodDetail, Task, SpecialEvents, SpecialEvent, TaskSourceCollection, Vacations, UserRole } from '../../types';
import { WORKERS } from '../../constants';
import { getWeekData, formatDateForBookingKey, generateRepeatingDates } from '../../utils/dateUtils';
import { getDefaultDailyShift, calculateUpdatedShifts } from '../../utils/shiftUtils';
import SunIcon from '../icons/SunIcon';
import MoonIcon from '../icons/MoonIcon';
import SwitchIcon from '../icons/SwitchIcon';
import RefreshCcwIcon from '../icons/RefreshCcwIcon';
import DownloadIcon from '../icons/DownloadIcon';
import TrashIcon from '../icons/TrashIcon';
import { ensurePdfLibsLoaded, generateShiftsPDF } from '../../utils/pdfUtils';
import CheckIcon from '../icons/CheckIcon';
import StarIcon from '../icons/StarIcon';

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

const SHIFT_ASSIGNEES = ['MAÑANA', 'TARDE'];
const WEEKDAYS = [
    { label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'X', value: 3 },
    { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 },
    { label: 'D', value: 0 }
];

const ShiftsView: React.FC<ShiftsViewProps> = ({ shiftAssignments, specialEvents, selectedDate, onDateChange, onUpdateShifts, onAddRecurringTask, onToggleTask, onResetWeekShifts, isReadOnly, vacations, handleUpdateVacations, currentUserName, userRole }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    const [showCompletedTasks, setShowCompletedTasks] = useState(false);
    
    // State for repetition logic
    const [repeatOption, setRepeatOption] = useState('none');
    const [repeatEndDate, setRepeatEndDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
    });
    const [selectedWeekdays, setSelectedWeekdays] = useState(new Set([1, 2, 3, 4, 5]));

    useEffect(() => {
        const newEndDate = new Date(selectedDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        setRepeatEndDate(newEndDate);
    }, [selectedDate]);
    
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

    const allTasks = useMemo(() => {
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

    const handleAssigneeChange = (worker: string) => {
        setNewTaskAssignees(prev =>
            prev.includes(worker)
                ? prev.filter(w => w !== worker)
                : [...prev, worker]
        );
    };

    const handleWeekdaySelect = (dayValue: number) => {
        setSelectedWeekdays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayValue)) {
                if (newSet.size > 1) { 
                    newSet.delete(dayValue);
                }
            } else {
                newSet.add(dayValue);
            }
            return newSet;
        });
    };

    const handleAddTask = async () => {
        if (!newTaskText.trim() || newTaskAssignees.length === 0) {
            alert("La tarea debe tener una descripción y al menos un asignado.");
            return;
        }
    
        const taskDetails = {
            text: newTaskText.trim(),
            assignedTo: newTaskAssignees,
        };
    
        const mondayOfWeek = weekDays[0];
        const datesForTask = Array.from(generateRepeatingDates(mondayOfWeek, repeatOption, repeatEndDate, selectedWeekdays));
    
        if (datesForTask.length === 0) {
            alert("La regla de repetición no generó ninguna fecha válida.");
            return;
        }
    
        const weekIds = Array.from(new Set(datesForTask.map(date => {
            const { year, week } = getWeekData(date);
            return `${year}-${week.toString().padStart(2, '0')}`;
        })));
    
        const success = await onAddRecurringTask(taskDetails, weekIds);
    
        if (success) {
            setNewTaskText('');
            setNewTaskAssignees([]);
            setRepeatOption('none');
        }
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

    const handleDownloadPDF = async () => {
        setIsDownloading(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateShiftsPDF(weekNumber, year, weekDays, currentShifts, allTasks);
        }
        setIsDownloading(false);
    };

    const getResolvedAssignees = (task: CombinedTask): string[] => {
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
    };

    const currentYear = selectedDate.getFullYear().toString();
    const currentYearVacations = vacations[currentYear]?.dates || {};

    const handleAddVacation = (worker: string, dateStr: string) => {
        if (!dateStr) return;
        const date = new Date(`${dateStr}T00:00:00`);
        const formattedDate = formatDateForBookingKey(date);
    
        if (Object.keys(currentYearVacations).filter(d => currentYearVacations[d] === worker).length >= 30) {
            alert(`${worker} ya ha alcanzado el límite de 30 días de vacaciones.`);
            return;
        }
        if (currentYearVacations[formattedDate] && currentYearVacations[formattedDate] !== worker) {
            alert(`El día ${formattedDate} ya está cogido por ${currentYearVacations[formattedDate]}.`);
            return;
        }
    
        const newDates = { ...currentYearVacations, [formattedDate]: worker };
        handleUpdateVacations(currentYear, newDates);
    };
    
    const handleRemoveVacation = (date: string) => {
        const newDates = { ...currentYearVacations };
        delete newDates[date];
        handleUpdateVacations(currentYear, newDates);
    };

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
                    <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                    <h2 className="text-xl font-bold text-white text-center w-full sm:w-auto">
                        Gestión de Turnos - Semana {weekNumber}
                        <span className="block text-sm font-normal text-gray-400">
                            {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </h2>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente Semana &gt;</button>
                      <button
                          onClick={handleDownloadPDF}
                          disabled={isDownloading}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                          title="Descargar horario semanal en PDF"
                      >
                          <DownloadIcon className="w-5 h-5" />
                          <span className="hidden sm:inline">{isDownloading ? 'Generando...' : 'PDF'}</span>
                      </button>
                    </div>
                </div>
                
                <fieldset disabled={isReadOnly} className={`mt-6 bg-black/20 p-4 rounded-lg flex flex-col md:flex-row items-center justify-center gap-4 flex-wrap ${isReadOnly ? 'opacity-70' : ''}`}>
                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-orange-400">Turno Mañana (por defecto):</span>
                        <select 
                            value={currentShifts.morning} 
                            onChange={(e) => handleWeeklyWorkerChange('morning', e.target.value)}
                            className="bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed"
                        >
                            {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                     <div className="flex items-center gap-3">
                        <span className="font-semibold text-yellow-400">Turno Tarde (por defecto):</span>
                        <select 
                            value={currentShifts.evening}
                            onChange={(e) => handleWeeklyWorkerChange('evening', e.target.value)}
                            className="bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed"
                        >
                             {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleSwap}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Intercambiar turno de mañana y tarde para toda la semana"
                    >
                        <SwitchIcon className="w-5 h-5" />
                        Intercambiar
                    </button>
                    {isCustomized && (
                        <button
                            onClick={handleReset}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Resetear Semana
                        </button>
                    )}
                </fieldset>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {weekDays.map((day, dayIndex) => {
                    const dailyOverride = currentShifts.dailyOverrides?.[dayIndex];
                    const effectiveShifts = dailyOverride || getDefaultDailyShift(dayIndex, currentShifts.morning, currentShifts.evening);
                    const isDayCustomized = !!dailyOverride;
                    const dayKey = formatDateForBookingKey(day);
                    const vacationWorkerForDay = vacations[year]?.dates[dayKey];
                    
                    const ShiftEditor = ({ period, details }: { period: 'morning' | 'evening', details: ShiftPeriodDetail }) => {
                        const isVacation = details.worker === vacationWorkerForDay;

                        if (isVacation) {
                            return (
                                <div className="p-2 bg-purple-900/50 rounded-md text-center h-[116px] flex flex-col justify-center">
                                    <p className="font-bold text-purple-300">VACACIONES</p>
                                    <p className="text-sm text-purple-400">{details.worker}</p>
                                </div>
                            );
                        }
                        
                        return (
                         <fieldset disabled={isReadOnly} className={`p-2 bg-black/20 rounded-md space-y-2 ${isReadOnly ? 'opacity-70' : ''}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {period === 'morning' ? <SunIcon className="w-5 h-5 text-yellow-300"/> : <MoonIcon className="w-5 h-5 text-blue-300"/>}
                                    <p className="text-gray-300 font-semibold capitalize text-sm">{period === 'morning' ? 'Mañana' : 'Tarde'}</p>
                                </div>
                                <label className="flex items-center cursor-pointer">
                                    <input type="checkbox" className="h-4 w-4 rounded bg-black/30 border-white/20 text-orange-500 focus:ring-orange-500 disabled:cursor-not-allowed" checked={details.active} onChange={(e) => handleDailyShiftChange(dayIndex, period, 'active', e.target.checked)} />
                                    <span className={`ml-2 text-xs font-medium ${details.active ? 'text-green-400' : 'text-red-400'}`}>{details.active ? 'Abierto' : 'Cerrado'}</span>
                                </label>
                            </div>
                            <div className={`space-y-2 transition-opacity ${!details.active ? 'opacity-50 pointer-events-none' : ''}`}>
                                <select value={details.worker} onChange={(e) => handleDailyShiftChange(dayIndex, period, 'worker', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 text-xs focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed">
                                    {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                                </select>
                                <div className="flex items-center gap-1 text-xs">
                                    <input type="time" value={details.start} onChange={(e) => handleDailyShiftChange(dayIndex, period, 'start', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed" />
                                    <span>-</span>
                                    <input type="time" value={details.end} onChange={(e) => handleDailyShiftChange(dayIndex, period, 'end', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed" />
                                </div>
                            </div>
                        </fieldset>
                        );
                    };

                    return (
                        <div key={day.toISOString()} className={`bg-white/5 backdrop-blur-lg p-3 rounded-lg shadow-inner transition-all border border-white/10 ${isDayCustomized && !isReadOnly ? 'ring-2 ring-blue-500' : ''}`}>
                            <div className="flex items-center justify-center text-center border-b border-white/20 pb-2 mb-3 relative h-10">
                                <h3 className="font-bold capitalize text-white">
                                    {day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                </h3>
                                {isDayCustomized && (
                                    <button onClick={() => handleResetDay(dayIndex)} disabled={isReadOnly} className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed" title="Resetear turno del día">
                                        <RefreshCcwIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                <ShiftEditor period="morning" details={effectiveShifts.morning} />
                                <ShiftEditor period="evening" details={effectiveShifts.evening} />
                            </div>
                        </div>
                    );
                })}
            </div>

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
                {!isReadOnly && (
                    <fieldset disabled={isReadOnly} className={`space-y-3 mb-4 p-3 bg-black/20 rounded-md ${isReadOnly ? 'opacity-70' : ''}`}>
                        <input 
                            type="text"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            placeholder="Descripción de la nueva tarea de turno..."
                            className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <span className="text-sm font-medium text-gray-300">Asignar a:</span>
                            {[...SHIFT_ASSIGNEES, ...WORKERS].map(assignee => (
                                <label key={assignee} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newTaskAssignees.includes(assignee)}
                                        onChange={() => handleAssigneeChange(assignee)}
                                        className="h-4 w-4 rounded bg-black/40 border-white/30 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className={SHIFT_ASSIGNEES.includes(assignee) ? 'text-yellow-400 font-semibold' : 'text-white'}>
                                        {assignee}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-3">
                            <div>
                                <label htmlFor="repeatOption" className="text-xs text-gray-400 block mb-1">Repetición</label>
                                <select id="repeatOption" value={repeatOption} onChange={(e) => setRepeatOption(e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500">
                                    <option value="none">Esta semana solo</option>
                                    <option value="daily">Diariamente</option>
                                    <option value="weekdays">Días laborables (L-V)</option>
                                    <option value="weekly">Semanalmente</option>
                                    <option value="monthly">Mensualmente</option>
                                </select>
                            </div>
                            {repeatOption !== 'none' && (
                                <div>
                                    <label htmlFor="repeatEndDate" className="text-xs text-gray-400 block mb-1">Finaliza el</label>
                                    <input id="repeatEndDate" type="date" value={formatDateForBookingKey(repeatEndDate)} onChange={(e) => e.target.value && setRepeatEndDate(new Date(`${e.target.value}T00:00:00`))} min={formatDateForBookingKey(weekDays[0])} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"/>
                                </div>
                            )}
                        </div>
                        {repeatOption === 'weekly' && (
                             <div>
                                <label className="text-xs text-gray-400 block mb-2">Repetir los días</label>
                                <div className="flex items-center justify-around bg-black/30 p-2 rounded-md">
                                    {WEEKDAYS.map(({label, value}) => (
                                        <button key={value} type="button" onClick={() => handleWeekdaySelect(value)} className={`w-8 h-8 rounded-full font-bold text-sm transition-colors duration-200 flex items-center justify-center ${ selectedWeekdays.has(value) ? 'bg-orange-600 text-white' : 'bg-black/30 hover:bg-white/10 text-gray-300' }`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <button
                            onClick={handleAddTask}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            Añadir Tarea de Turno
                        </button>
                    </fieldset>
                )}
                <div className="space-y-2">
                    {allTasks.length > 0 ? (
                        tasksToDisplay.length > 0 ? (
                            tasksToDisplay.map(task => {
                                const isEventTask = task.type === 'event';
                                const resolvedAssignees = getResolvedAssignees(task);

                                return (
                                    <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
                                        {isEventTask && <StarIcon className="w-4 h-4 flex-shrink-0 text-purple-400" />}
                                        <button
                                            onClick={() => onToggleTask(
                                                task.sourceId,
                                                task.id,
                                                isEventTask ? 'specialEvents' : 'shiftAssignments'
                                            )}
                                            disabled={isReadOnly}
                                            className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors duration-200 disabled:cursor-not-allowed ${
                                                task.completed
                                                    ? 'bg-green-500 hover:bg-green-600'
                                                    : `border-2 ${isEventTask ? 'border-purple-400' : 'border-gray-500'} hover:bg-white/10`
                                            }`}
                                            aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                                        >
                                            {task.completed && <CheckIcon className="w-3 h-3 text-white" />}
                                        </button>
                                        <div className="flex-grow">
                                            <span className={`${task.completed ? 'line-through text-gray-500' : (isEventTask ? 'text-purple-200' : 'text-gray-200')}`}>
                                                {isEventTask && <span className="font-semibold text-purple-400 mr-1">[{task.eventName}]</span>}
                                                {task.text}
                                            </span>
                                        </div>

                                        <div className="flex-shrink-0 flex items-center flex-wrap gap-1 justify-end">
                                            {resolvedAssignees.map(assignee => (
                                                assignee && (
                                                    <span key={assignee} className="bg-blue-900/70 text-blue-300 text-xs font-semibold px-2 py-1 rounded-full">
                                                        {assignee}
                                                    </span>
                                                )
                                            ))}
                                        </div>
                                       
                                        {!isReadOnly && task.type === 'shift' && (
                                            <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-white/10 transition-colors flex-shrink-0" title="Eliminar tarea">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
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
                <label htmlFor="weekObservations" className="text-lg font-semibold text-orange-400 mb-2 block">
                    Observaciones de la Semana
                </label>
                <textarea
                    id="weekObservations"
                    value={currentShifts.observations || ''}
                    onChange={handleObservationsChange}
                    rows={4}
                    placeholder="Anotaciones importantes para la semana, eventos especiales, recordatorios, etc."
                    className="w-full bg-black/20 text-white border-white/20 rounded-md p-3 focus:ring-orange-500 focus:border-orange-500 resize-y disabled:cursor-not-allowed"
                    disabled={isReadOnly}
                />
            </div>

            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <h3 className="text-lg font-semibold text-orange-400 mb-3">Gestión de Vacaciones ({currentYear})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['Olga', 'Dani'].map(worker => {
                        const canManage = userRole === 'ADMIN' || currentUserName === worker;
                        const workerVacations = Object.entries(currentYearVacations)
                            .filter(([, name]) => name === worker)
                            .map(([date]) => date)
                            .sort();

                        const VacationManager = () => {
                            const [newVacationDate, setNewVacationDate] = useState('');
                            return (
                                <div>
                                    <h4 className="font-bold text-white">{worker}</h4>
                                    <p className="text-sm text-gray-400 mb-2">{workerVacations.length} / 30 días</p>
                                    
                                    {canManage && !isReadOnly && (
                                        <div className="flex items-center gap-2 mb-3">
                                            <input 
                                                type="date" 
                                                value={newVacationDate}
                                                onChange={(e) => setNewVacationDate(e.target.value)}
                                                className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                            />
                                            <button
                                                onClick={() => {
                                                    handleAddVacation(worker, newVacationDate);
                                                    setNewVacationDate('');
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-md text-sm"
                                            >
                                                Añadir
                                            </button>
                                        </div>
                                    )}
                                
                                    <div className="space-y-1 max-h-40 overflow-y-auto bg-black/20 p-2 rounded-md">
                                        {workerVacations.length > 0 ? workerVacations.map(date => (
                                            <div key={date} className="flex items-center justify-between text-sm p-1">
                                                <span className="text-gray-300">{new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                                {canManage && !isReadOnly && (
                                                    <button onClick={() => handleRemoveVacation(date)} className="text-red-500 hover:text-red-400">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )) : <p className="text-xs text-gray-500 text-center">No hay vacaciones asignadas.</p>}
                                    </div>
                                </div>
                            );
                        };
                        return <VacationManager key={worker} />;
                    })}
                </div>
            </div>
        </div>
    );
};

export default ShiftsView;