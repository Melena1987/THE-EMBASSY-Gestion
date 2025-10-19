import React, { useMemo, useState } from 'react';
import type { ShiftAssignments, ShiftAssignment, DailyShift, ShiftPeriodDetail, Task } from '../types';
import { WORKERS } from '../constants';
import { getWeekData } from '../utils/dateUtils';
import { getDefaultDailyShift, calculateUpdatedShifts } from '../utils/shiftUtils';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import SwitchIcon from './icons/SwitchIcon';
import RefreshCcwIcon from './icons/RefreshCcwIcon';
import DownloadIcon from './icons/DownloadIcon';
import TrashIcon from './icons/TrashIcon';
import { ensurePdfLibsLoaded, generateShiftsPDF } from '../utils/pdfUtils';

interface ShiftsViewProps {
    shiftAssignments: ShiftAssignments;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onUpdateShifts: (weekId: string, newShifts: ShiftAssignment) => void;
    onToggleTask: (weekId: string, taskId: string) => void;
    onResetWeekShifts: (weekId: string) => void;
    isReadOnly: boolean;
}

const ShiftsView: React.FC<ShiftsViewProps> = ({ shiftAssignments, selectedDate, onDateChange, onUpdateShifts, onToggleTask, onResetWeekShifts, isReadOnly }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);

    const { week: weekNumber, year } = getWeekData(selectedDate);
    const weekId = `${year}-${weekNumber.toString().padStart(2, '0')}`;

    const weekDays = useMemo(() => {
        const referenceDate = new Date(selectedDate);
        const dayOfWeek = referenceDate.getDay();
        const diffToMonday = referenceDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        const monday = new Date(referenceDate.setDate(diffToMonday));
    
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

    const currentShifts = shiftAssignments[weekId] || defaultAssignments;
    const isCustomized = !!shiftAssignments[weekId];

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

    const handleAddTask = () => {
        if (!newTaskText.trim() || newTaskAssignees.length === 0) {
            alert("La tarea debe tener una descripción y al menos un asignado.");
            return;
        }

        const newTask: Task = {
            id: Date.now().toString(),
            text: newTaskText.trim(),
            assignedTo: newTaskAssignees,
            completed: false,
        };

        const newShifts: ShiftAssignment = {
            ...currentShifts,
            tasks: [...(currentShifts.tasks || []), newTask],
        };
        onUpdateShifts(weekId, newShifts);
        setNewTaskText('');
        setNewTaskAssignees([]);
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
            await generateShiftsPDF(weekNumber, year, weekDays, currentShifts);
        }
        setIsDownloading(false);
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
                    
                    const ShiftEditor = ({ period, details }: { period: 'morning' | 'evening', details: ShiftPeriodDetail }) => (
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
                <h3 className="text-lg font-semibold text-orange-400 mb-3">Tareas de la Semana</h3>
                {!isReadOnly && (
                    <div className="space-y-3 mb-4 p-3 bg-black/20 rounded-md">
                        <input 
                            type="text"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            placeholder="Descripción de la tarea..."
                            className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <span className="text-sm font-medium text-gray-300">Asignar a:</span>
                            {WORKERS.map(w => (
                                <label key={w} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newTaskAssignees.includes(w)}
                                        onChange={() => handleAssigneeChange(w)}
                                        className="h-4 w-4 rounded bg-black/40 border-white/30 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-white">{w}</span>
                                </label>
                            ))}
                        </div>
                        <button
                            onClick={handleAddTask}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            Añadir Tarea
                        </button>
                    </div>
                )}
                <div className="space-y-2">
                    {currentShifts.tasks && currentShifts.tasks.length > 0 ? (
                        currentShifts.tasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
                                <input
                                    type="checkbox"
                                    checked={task.completed}
                                    onChange={() => onToggleTask(weekId, task.id)}
                                    className="h-5 w-5 rounded bg-black/30 border-white/20 text-orange-500 focus:ring-orange-500 cursor-pointer flex-shrink-0"
                                />
                                <span className={`flex-grow ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                    {task.text}
                                </span>
                                <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full flex-shrink-0">
                                    {task.assignedTo.join(', ')}
                                </span>
                                {!isReadOnly && (
                                    <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-white/10 transition-colors flex-shrink-0" title="Eliminar tarea">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))
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
        </div>
    );
};

export default ShiftsView;