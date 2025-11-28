
import React, { useState, useMemo } from 'react';
import type { Task, TaskSourceCollection, ShiftAssignment } from '../../../types';
import CheckIcon from '../../icons/CheckIcon';

type CombinedTask = (Task & {
    type: 'shift';
    sourceId: string;
}) | (Task & {
    type: 'event';
    sourceId: string;
    eventName: string;
});

interface AgendaTasksObservationsProps {
    allTasks: CombinedTask[];
    onToggleTask: (sourceId: string, taskId: string, collectionName: TaskSourceCollection) => void;
    getResolvedAssignees: (task: CombinedTask) => string[];
    currentWeekShifts: ShiftAssignment | undefined;
    canAddObservations: boolean;
    onUpdateShifts: (weekId: string, newShifts: ShiftAssignment) => void;
    weekId: string;
    defaultAssignments: { morning: string; evening: string };
    currentUserName: string | null;
}

const AgendaTasksObservations: React.FC<AgendaTasksObservationsProps> = ({
    allTasks, onToggleTask, getResolvedAssignees, currentWeekShifts, canAddObservations, onUpdateShifts, weekId, defaultAssignments, currentUserName
}) => {
    const [showCompletedTasks, setShowCompletedTasks] = useState(false);
    const [newObservationText, setNewObservationText] = useState('');

    const completedTasks = useMemo(() => allTasks.filter(task => task.completed), [allTasks]);
    const tasksToDisplay = useMemo(() => {
        if (showCompletedTasks) {
            return [...allTasks.filter(t => !t.completed), ...completedTasks];
        }
        return allTasks.filter(task => !task.completed);
    }, [allTasks, showCompletedTasks]);

    const handleAddObservation = () => {
        if (!newObservationText.trim() || !currentUserName) return;

        const baseShifts = currentWeekShifts || {
            morning: defaultAssignments.morning,
            evening: defaultAssignments.evening,
        };

        const today = new Date();
        const dateStamp = today.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

        const observationLine = `\n- [${dateStamp}] ${currentUserName}: ${newObservationText.trim()}`;
        const existingObservations = baseShifts.observations || '';
        const updatedObservations = (existingObservations ? existingObservations.trim() : '') + observationLine;
        
        const updatedShifts: ShiftAssignment = {
            ...baseShifts,
            observations: updatedObservations
        };

        onUpdateShifts(weekId, updatedShifts);
        setNewObservationText('');
    };

    const renderObservations = (text: string) => {
        if (!text) return 'No hay observaciones para esta semana.';
        
        return text.split('\n').map((line, index) => {
            if (!line.trim()) return <br key={index} />;
            
            const isReservasLog = line.includes('RESERVAS:');
            const isDoneLog = line.includes('HECHO:');
            
            let className = 'block text-gray-300';
            if (isReservasLog) className = 'block text-orange-500 font-bold';
            if (isDoneLog) className = 'block text-green-400 font-bold';
            
            return (
                <span key={index} className={className}>
                    {line}
                </span>
            );
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {allTasks.length > 0 ? (
                        tasksToDisplay.length > 0 ? (
                            tasksToDisplay.map(task => {
                                const isEventTask = task.type === 'event';
                                const resolvedAssignees = getResolvedAssignees(task);
                                return (
                                    <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
                                        <button
                                            onClick={() => onToggleTask(task.sourceId, task.id, isEventTask ? 'specialEvents' : 'shiftAssignments')}
                                            className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors duration-200 ${task.completed ? 'bg-green-500 hover:bg-green-600' : `border-2 ${isEventTask ? 'border-purple-400' : 'border-gray-500'} hover:bg-white/10`}`}
                                            aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                                        >
                                            {task.completed && <CheckIcon className="w-3 h-3 text-white" />}
                                        </button>
                                        <div className="flex-grow text-sm">
                                            {isEventTask && <span className="font-semibold text-purple-400 mr-1">[{task.eventName}]</span>}
                                            <span className={`${task.completed ? 'line-through text-gray-500' : (isEventTask ? 'text-purple-200' : 'text-gray-200')}`}>
                                                {task.text}
                                            </span>
                                        </div>
                                        {resolvedAssignees.length > 0 && (
                                            <div className="flex-shrink-0 flex items-center flex-wrap gap-1 justify-end">
                                                {resolvedAssignees.map(assignee => (
                                                    assignee && <span key={assignee} className="bg-blue-900/70 text-blue-300 text-xs font-semibold px-2 py-1 rounded-full">{assignee}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (<p className="text-sm text-gray-500 text-center py-2">Todas las tareas están completadas. ¡Bien hecho!</p>)
                    ) : (<p className="text-sm text-gray-500 text-center py-2">No hay tareas para esta semana.</p>)}
                </div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <h3 className="text-lg font-semibold text-orange-400 mb-2">Observaciones de Turnos</h3>
                <div className="bg-black/20 p-3 rounded-md min-h-[100px] max-h-[250px] overflow-y-auto text-sm">
                    {renderObservations(currentWeekShifts?.observations || '')}
                </div>
                {canAddObservations && (
                    <div className="mt-3 space-y-2">
                        <textarea
                            value={newObservationText}
                            onChange={(e) => setNewObservationText(e.target.value)}
                            rows={2}
                            placeholder="Añadir una nueva observación..."
                            className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 resize-y"
                        />
                        <button
                            onClick={handleAddObservation}
                            disabled={!newObservationText.trim()}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Añadir Observación
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgendaTasksObservations;
