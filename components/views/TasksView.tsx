import React, { useState, useMemo } from 'react';
import type { SpecialEvents, Sponsors, SpecialEvent, Sponsor, Task, TaskSourceCollection, UserRole } from '../../types';
import CheckIcon from '../icons/CheckIcon';

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
}

const TasksView: React.FC<TasksViewProps> = ({ specialEvents, sponsors, onToggleTask, currentUserName, userRole }) => {
    const [filterAssignee, setFilterAssignee] = useState(userRole === 'TRABAJADOR' ? 'me' : 'all');
    const [filterStatus, setFilterStatus] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');

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
            // FIX: Ensure task.assignedTo is an array before calling array methods.
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

            <div className="space-y-6">
                {Object.keys(filteredAndGroupedTasks).length > 0 ? (
                    Object.entries(filteredAndGroupedTasks).map(([sourceName, tasks]) => (
                        <div key={sourceName} className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                            <h3 className="text-lg font-semibold text-orange-400 mb-3 border-b border-white/10 pb-2">{sourceName}</h3>
                            <div className="space-y-2">
                                {tasks.map(task => {
                                    // FIX: Ensure task.assignedTo is always treated as an array to prevent crashes.
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
                    ))
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
