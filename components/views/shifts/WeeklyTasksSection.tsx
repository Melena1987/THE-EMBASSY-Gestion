import React, { useState, useMemo, useEffect } from 'react';
import type { Task, TaskSourceCollection, ShiftAssignment } from '../../types';
import { WORKERS } from '../../constants';
import { getWeekData, formatDateForBookingKey, generateRepeatingDates } from '../../utils/dateUtils';
import TrashIcon from '../../icons/TrashIcon';
import CheckIcon from '../../icons/CheckIcon';
import StarIcon from '../../icons/StarIcon';

type CombinedTask = (Task & {
    type: 'shift';
    sourceId: string;
}) | (Task & {
    type: 'event';
    sourceId: string;
    eventName: string;
});

interface WeeklyTasksSectionProps {
    allTasks: CombinedTask[];
    isReadOnly: boolean;
    onToggleTask: (sourceId: string, taskId: string, collectionName: TaskSourceCollection) => void;
    onDeleteTask: (taskId: string) => void;
    onAddSingleTask: (taskDetails: Omit<Task, 'id' | 'completed' | 'recurrenceId'>) => void;
    onAddRecurringTask: (taskDetails: Omit<Task, 'id' | 'completed' | 'recurrenceId'>, weekIds: string[]) => Promise<boolean>;
    selectedDate: Date;
    weekDays: Date[];
    getResolvedAssignees: (task: CombinedTask) => string[];
}

const SHIFT_ASSIGNEES = ['MAÑANA', 'TARDE'];
const WEEKDAYS = [
    { label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'X', value: 3 },
    { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 },
    { label: 'D', value: 0 }
];

const WeeklyTasksSection: React.FC<WeeklyTasksSectionProps> = ({
    allTasks, isReadOnly, onToggleTask, onDeleteTask, onAddSingleTask, onAddRecurringTask, selectedDate, weekDays, getResolvedAssignees
}) => {
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    const [showCompletedTasks, setShowCompletedTasks] = useState(false);
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

    const completedTasks = useMemo(() => allTasks.filter(task => task.completed), [allTasks]);
    const tasksToDisplay = useMemo(() => {
        if (showCompletedTasks) {
            return [...allTasks.filter(t => !t.completed), ...completedTasks];
        }
        return allTasks.filter(task => !task.completed);
    }, [allTasks, showCompletedTasks]);

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
        
        const resetForm = () => {
            setNewTaskText('');
            setNewTaskAssignees([]);
            setRepeatOption('none');
        };

        if (repeatOption === 'none') {
            onAddSingleTask(taskDetails);
            resetForm();
            return;
        }

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
            resetForm();
        }
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-orange-400">Tareas de la Semana</h3>
                {completedTasks.length > 0 && (
                    <button onClick={() => setShowCompletedTasks(prev => !prev)} className="text-sm text-gray-400 hover:text-white underline focus:outline-none">
                        {showCompletedTasks ? 'Ocultar completadas' : `Mostrar ${completedTasks.length} completada${completedTasks.length > 1 ? 's' : ''}`}
                    </button>
                )}
            </div>
            {!isReadOnly && (
                <fieldset disabled={isReadOnly} className={`space-y-3 mb-4 p-3 bg-black/20 rounded-md ${isReadOnly ? 'opacity-70' : ''}`}>
                    <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Descripción de la nueva tarea de turno..." className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="text-sm font-medium text-gray-300">Asignar a:</span>
                        {[...SHIFT_ASSIGNEES, ...WORKERS].map(assignee => (
                            <label key={assignee} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={newTaskAssignees.includes(assignee)} onChange={() => handleAssigneeChange(assignee)} className="h-4 w-4 rounded bg-black/40 border-white/30 text-orange-500 focus:ring-orange-500" />
                                <span className={SHIFT_ASSIGNEES.includes(assignee) ? 'text-yellow-400 font-semibold' : 'text-white'}>{assignee}</span>
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
                                <input id="repeatEndDate" type="date" value={formatDateForBookingKey(repeatEndDate)} onChange={(e) => e.target.value && setRepeatEndDate(new Date(`${e.target.value}T00:00:00`))} min={formatDateForBookingKey(weekDays[0])} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                            </div>
                        )}
                    </div>
                    {repeatOption === 'weekly' && (
                        <div>
                            <label className="text-xs text-gray-400 block mb-2">Repetir los días</label>
                            <div className="flex items-center justify-around bg-black/30 p-2 rounded-md">
                                {WEEKDAYS.map(({ label, value }) => (
                                    <button key={value} type="button" onClick={() => handleWeekdaySelect(value)} className={`w-8 h-8 rounded-full font-bold text-sm transition-colors duration-200 flex items-center justify-center ${selectedWeekdays.has(value) ? 'bg-orange-600 text-white' : 'bg-black/30 hover:bg-white/10 text-gray-300'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <button onClick={handleAddTask} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors">Añadir Tarea de Turno</button>
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
                                    <button onClick={() => onToggleTask(task.sourceId, task.id, isEventTask ? 'specialEvents' : 'shiftAssignments')} disabled={isReadOnly} className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors duration-200 disabled:cursor-not-allowed ${task.completed ? 'bg-green-500 hover:bg-green-600' : `border-2 ${isEventTask ? 'border-purple-400' : 'border-gray-500'} hover:bg-white/10`}`} aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}>
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
                                                <span key={assignee} className="bg-blue-900/70 text-blue-300 text-xs font-semibold px-2 py-1 rounded-full">{assignee}</span>
                                            )
                                        ))}
                                    </div>
                                    {!isReadOnly && task.type === 'shift' && (
                                        <button onClick={() => onDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-white/10 transition-colors flex-shrink-0" title="Eliminar tarea">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    ) : (<p className="text-sm text-gray-500 text-center py-2">Todas las tareas están completadas. ¡Bien hecho!</p>)
                ) : (<p className="text-sm text-gray-500 text-center py-2">No hay tareas para esta semana.</p>)}
            </div>
        </div>
    );
};

export default WeeklyTasksSection;