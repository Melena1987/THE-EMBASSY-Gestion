import React from 'react';
import type { Task } from '../../../types';
import { WORKERS } from '../../../constants';
import TrashIcon from '../../icons/TrashIcon';

interface EventTasksFormProps {
    tasks: Task[];
    newTaskText: string;
    newTaskAssignees: string[];
    onNewTaskTextChange: (value: string) => void;
    onNewTaskAssigneesChange: (assignees: string[]) => void;
    onAddTask: () => void;
    onDeleteTask: (taskId: string) => void;
    isReadOnly: boolean;
    isUploading: boolean;
}

const EventTasksForm: React.FC<EventTasksFormProps> = ({
    tasks,
    newTaskText,
    newTaskAssignees,
    onNewTaskTextChange,
    onNewTaskAssigneesChange,
    onAddTask,
    onDeleteTask,
    isReadOnly,
    isUploading,
}) => {
    const handleAssigneeChange = (worker: string) => {
        const newAssignees = newTaskAssignees.includes(worker)
            ? newTaskAssignees.filter(w => w !== worker)
            : [...newTaskAssignees, worker];
        onNewTaskAssigneesChange(newAssignees);
    };

    return (
        <fieldset disabled={isReadOnly || isUploading} className={`space-y-4 ${isReadOnly || isUploading ? 'opacity-70' : ''}`}>
            <div className="p-3 bg-black/20 rounded-md space-y-3">
                <input type="text" value={newTaskText} onChange={e => onNewTaskTextChange(e.target.value)} placeholder="Descripción de la tarea..." className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-sm font-medium text-gray-300">Asignar a:</span>
                    {WORKERS.map(w => (
                        <label key={w} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={newTaskAssignees.includes(w)} onChange={() => handleAssigneeChange(w)} className="h-4 w-4 rounded bg-black/40 border-white/30 text-orange-500 focus:ring-orange-500" />
                            <span className="text-white">{w}</span>
                        </label>
                    ))}
                </div>
                <button onClick={onAddTask} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-md">Añadir Tarea</button>
            </div>
            <div className="space-y-2">
                {tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
                        <span className="flex-grow text-gray-200">{task.text}</span>
                        <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full">{Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo}</span>
                        <button onClick={() => onDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>
        </fieldset>
    );
};

export default EventTasksForm;
