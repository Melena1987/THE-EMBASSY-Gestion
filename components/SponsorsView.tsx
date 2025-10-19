import React, { useState, useEffect } from 'react';
import type { Sponsors, Sponsor, Task } from '../types';
import { SPONSOR_ASSIGNEES } from '../constants';
import TrashIcon from './icons/TrashIcon';

interface SponsorsViewProps {
    sponsors: Sponsors;
    onUpdateSponsor: (sponsorId: string, newSponsorData: Sponsor) => void;
    isReadOnly: boolean;
}

const SponsorsView: React.FC<SponsorsViewProps> = ({ sponsors, onUpdateSponsor, isReadOnly }) => {
    const sponsorIds = Object.keys(sponsors);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);

    useEffect(() => {
        if (!activeTab && sponsorIds.length > 0) {
            setActiveTab(sponsorIds[0]);
        }
    }, [sponsorIds, activeTab]);

    const activeSponsor = activeTab ? sponsors[activeTab] : null;

    const handleUpdateTask = (updatedTasks: Task[]) => {
        if (!activeSponsor) return;
        const updatedSponsor: Sponsor = { ...activeSponsor, tasks: updatedTasks };
        onUpdateSponsor(activeSponsor.id, updatedSponsor);
    };

    const handleToggleTask = (taskId: string) => {
        const updatedTasks = activeSponsor?.tasks?.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
        ) || [];
        handleUpdateTask(updatedTasks);
    };
    
    const handleDeleteTask = (taskId: string) => {
        const updatedTasks = activeSponsor?.tasks?.filter(task => task.id !== taskId) || [];
        handleUpdateTask(updatedTasks);
    };

    const handleAddTask = () => {
        if (!newTaskText.trim() || newTaskAssignees.length === 0 || !activeSponsor) {
            alert("La tarea debe tener una descripción y al menos un asignado.");
            return;
        }
        const newTask: Task = {
            id: Date.now().toString(),
            text: newTaskText.trim(),
            assignedTo: newTaskAssignees,
            completed: false,
        };
        const updatedTasks = [...(activeSponsor.tasks || []), newTask];
        handleUpdateTask(updatedTasks);
        setNewTaskText('');
        setNewTaskAssignees([]);
    };
    
    const handleAssigneeChange = (worker: string) => {
        setNewTaskAssignees(prev =>
            prev.includes(worker)
                ? prev.filter(w => w !== worker)
                : [...prev, worker]
        );
    };

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Gestión de Patrocinadores</h2>
                <div className="border-b border-white/20">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        {sponsorIds.map(id => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={`${
                                    activeTab === id
                                        ? 'border-orange-500 text-orange-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300'
                                } whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors`}
                            >
                                {sponsors[id].name}
                            </button>
                        ))}
                    </nav>
                </div>

                 <div className="mt-4">
                    {activeSponsor ? (
                        <fieldset disabled={isReadOnly} className={`space-y-4 ${isReadOnly ? 'opacity-70' : ''}`}>
                             <div className="space-y-2">
                                {(activeSponsor.tasks || []).length > 0 ? (
                                    (activeSponsor.tasks || []).map(task => (
                                        <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
                                            <input
                                                type="checkbox"
                                                checked={task.completed}
                                                onChange={() => handleToggleTask(task.id)}
                                                className="h-5 w-5 rounded bg-black/30 border-white/20 text-orange-500 focus:ring-orange-500 cursor-pointer flex-shrink-0"
                                                disabled={isReadOnly}
                                            />
                                            <span className={`flex-grow ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                                {task.text}
                                            </span>
                                            <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full flex-shrink-0">
                                                {Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo}
                                            </span>
                                            {!isReadOnly && (
                                                <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-white/10 transition-colors flex-shrink-0" title="Eliminar tarea">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-2">No hay tareas para este patrocinador.</p>
                                )}
                            </div>

                            {!isReadOnly && (
                                <div className="space-y-3 pt-4 border-t border-white/20">
                                    <h3 className="text-lg font-semibold text-orange-400">Añadir Nueva Tarea</h3>
                                    <input 
                                        type="text"
                                        value={newTaskText}
                                        onChange={(e) => setNewTaskText(e.target.value)}
                                        placeholder="Descripción de la tarea..."
                                        className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                     <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <span className="text-sm font-medium text-gray-300">Asignar a:</span>
                                        {SPONSOR_ASSIGNEES.map(w => (
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

                        </fieldset>
                    ) : (
                         <p className="text-center text-gray-400 pt-4">Seleccione un patrocinador o añada uno nuevo para empezar.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SponsorsView;
