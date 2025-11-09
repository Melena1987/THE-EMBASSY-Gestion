import React, { useState, useMemo, useEffect } from 'react';
import type { SpecialEvents, Sponsors, SpecialEvent, Sponsor, Task, TaskSourceCollection, UserRole } from '../../types';
import { WORKERS } from '../../constants';
import { getWeekData, formatDateForBookingKey, generateRepeatingDates } from '../../utils/dateUtils';
import CheckIcon from '../icons/CheckIcon';
import PlusIcon from '../icons/PlusIcon';

interface AggregatedTask extends Task {
  sourceCollection: TaskSourceCollection;
  sourceId: string;
  sourceName: string;
}

interface TasksViewProps {
    specialEvents: SpecialEvents;
    sponsors: Sponsors;
    onToggleTask: (sourceId: string, taskId: string, collection: TaskSourceCollection) => void;
    currentUserName: string | null;
    userRole: UserRole;
    selectedDate: Date;
    onAddRecurringTask: (taskDetails: Omit<Task, 'id' | 'completed' | 'recurrenceId'>, weekIds: string[]) => Promise<boolean>;
}

const SHIFT_ASSIGNEES = ['MAÑANA', 'TARDE'];
const WEEKDAYS = [
    { label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'X', value: 3 },
    { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 },
    { label: 'D', value: 0 }
];


const TasksView: React.FC<TasksViewProps> = ({ specialEvents, sponsors, onToggleTask, currentUserName, userRole, selectedDate, onAddRecurringTask }) => {
    const [filterAssignee, setFilterAssignee] = useState(userRole === 'TRABAJADOR' ? 'me' : 'all');
    const [filterStatus, setFilterStatus] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');

    const [isAdding, setIsAdding] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
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
            setIsAdding(false);
        };
        
        const dayOfWeek = selectedDate.getDay();
        const diffToMonday = selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        const mondayOfWeek = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), diffToMonday);

        if (repeatOption === 'none') {
            const { year, week } = getWeekData(mondayOfWeek);
            const weekId = `${year}-${week.toString().padStart(2, '0')}`;
            const success = await onAddRecurringTask(taskDetails, [weekId]);
            if (success) {
                resetForm();
            }
            return;
        }

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


    const allTasks = useMemo<AggregatedTask[]>(() => {
        const tasks: AggregatedTask[] = [];

        Object.values(specialEvents).forEach((event: SpecialEvent) => {
            (event.tasks || []).forEach(task => {
                tasks.push({
                    ...task,
                    sourceCollection: 'specialEvents',
                    sourceId: event.id,
                    sourceName: `Evento: ${event.name}`
                });
            });
        });

        Object.values(sponsors).forEach((sponsor: Sponsor) => {
            (sponsor.tasks || []).forEach(task => {
                tasks.push({
                    ...task,
                    sourceCollection: 'sponsors',
                    sourceId: sponsor.id,
                    sourceName: `Patrocinador: ${sponsor.name}`
                });
            });
        });

        return tasks;
    }, [specialEvents, sponsors]);

    const filteredAndGroupedTasks = useMemo(() => {
        const filtered = allTasks.filter(task => {
            const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
            const matchesAssignee = filterAssignee === 'all' || (currentUserName && assignees.includes(currentUserName));
            const matchesStatus = filterStatus === 'all' || (filterStatus === 'pending' && !task.completed) || (filterStatus === 'completed' && task.completed);
            const matchesSearch = !searchTerm || task.text.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesAssignee && matchesStatus && matchesSearch;
        });

        return filtered.reduce((acc, task) => {
            if (!acc[task.sourceName]) {
                acc[task.sourceName] = [];
            }
            acc[task.sourceName].push(task);
            return acc;
        }, {} as Record<string, AggregatedTask[]>);
    }, [allTasks, filterAssignee, filterStatus, searchTerm, currentUserName]);

    const canManageTasks = userRole === 'ADMIN' || userRole === 'EVENTOS';

    return (
        <div className="space-y-6 max-w-7xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-4">Gestión de Tareas</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label htmlFor="search-task" className="text-xs text-gray-400 block mb-1">Buscar Tarea</label>
                        <input
                            id="search-task"
                            type="text"
                            placeholder="Filtrar por texto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="filter-assignee" className="text-xs text-gray-400 block mb-1">Asignado A</label>
                        <select
                            id="filter-assignee"
                            value={filterAssignee}
                            onChange={(e) => setFilterAssignee(e.target.value)}
                            disabled={userRole === 'TRABAJADOR'}
                            className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                        >
                            {userRole !== 'TRABAJADOR' && <option value="all">Todos</option>}
                            <option value="me">Asignadas a mí</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Estado</label>
                        <div className="flex bg-black/20 rounded-md p-1">
                            <button onClick={() => setFilterStatus('pending')} className={`w-full py-1 px-2 text-sm rounded-md transition-colors ${filterStatus === 'pending' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}>Pendientes</button>
                            <button onClick={() => setFilterStatus('completed')} className={`w-full py-1 px-2 text-sm rounded-md transition-colors ${filterStatus === 'completed' ? 'bg-green-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}>Completadas</button>
                            <button onClick={() => setFilterStatus('all')} className={`w-full py-1 px-2 text-sm rounded-md transition-colors ${filterStatus === 'all' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}>Todas</button>
                        </div>
                    </div>
                </div>
            </div>

            {canManageTasks && (
                <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                    {isAdding ? (
                        <fieldset className="space-y-3">
                            <h3 className="text-lg font-semibold text-orange-400">Añadir Tarea de Turno</h3>
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
                                    <label htmlFor="repeatOption-taskview" className="text-xs text-gray-400 block mb-1">Repetición</label>
                                    <select id="repeatOption-taskview" value={repeatOption} onChange={(e) => setRepeatOption(e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500">
                                        <option value="none">Esta semana solo</option>
                                        <option value="daily">Diariamente</option>
                                        <option value="weekdays">Días laborables (L-V)</option>
                                        <option value="weekly">Semanalmente</option>
                                        <option value="monthly">Mensualmente</option>
                                    </select>
                                </div>
                                {repeatOption !== 'none' && (
                                    <div>
                                        <label htmlFor="repeatEndDate-taskview" className="text-xs text-gray-400 block mb-1">Finaliza el</label>
                                        <input id="repeatEndDate-taskview" type="date" value={formatDateForBookingKey(repeatEndDate)} onChange={(e) => e.target.value && setRepeatEndDate(new Date(`${e.target.value}T00:00:00`))} min={formatDateForBookingKey(selectedDate)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
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
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsAdding(false)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors">Cancelar</button>
                                <button onClick={handleAddTask} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors">Añadir Tarea</button>
                            </div>
                        </fieldset>
                    ) : (
                        <button onClick={() => setIsAdding(true)} className="w-full flex items-center justify-center gap-2 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/50 text-orange-300 font-bold py-2 px-4 rounded-md transition-colors">
                            <PlusIcon className="w-5 h-5" />
                            Añadir Tarea de Turno
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-6">
                {Object.keys(filteredAndGroupedTasks).length > 0 ? (
                    Object.keys(filteredAndGroupedTasks).map((sourceName) => {
                        const tasks = filteredAndGroupedTasks[sourceName];
                        return (
                            <div key={sourceName} className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                                <h3 className="text-lg font-semibold text-orange-400 mb-3 border-b border-white/10 pb-2">{sourceName}</h3>
                                <div className="space-y-2">
                                    {/* FIX: Refactored from Object.entries to Object.keys to fix TS type inference issue on `tasks`. */}
                                    {tasks.map(task => {
                                        const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
                                        const canToggle = canManageTasks || (currentUserName && assignees.includes(currentUserName));
                                        return (
                                            <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
                                                <button
                                                    onClick={() => canToggle && onToggleTask(task.sourceId, task.id, task.sourceCollection)}
                                                    disabled={!canToggle}
                                                    className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors duration-200 ${
                                                        task.completed ? 'bg-green-500' : 'border-2 border-gray-500'
                                                    } ${canToggle ? 'cursor-pointer hover:bg-white/10' : 'cursor-not-allowed opacity-50'}`}
                                                    aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                                                >
                                                    {task.completed && <CheckIcon className="w-3 h-3 text-white" />}
                                                </button>
                                                <span className={`flex-grow text-sm ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.text}</span>
                                                <div className="flex-shrink-0 flex items-center flex-wrap gap-1 justify-end">
                                                    {assignees.map(assignee => (
                                                        <span key={assignee} className="bg-blue-900/70 text-blue-300 text-xs font-semibold px-2 py-1 rounded-full">{assignee}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="text-center py-10 bg-white/5 rounded-lg">
                        <p className="text-gray-400">No hay tareas que coincidan con los filtros seleccionados.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TasksView;
