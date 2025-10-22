import React, { useMemo } from 'react';
import type { AppNotification, TaskSourceCollection, AggregatedTask, SpecialEventNotification, ShiftUpdateNotification } from '../types';
import CheckIcon from './icons/CheckIcon';
import BellIcon from './icons/BellIcon';
import StarIcon from './icons/StarIcon';
import UsersIcon from './icons/UsersIcon';

interface TasksDropdownProps {
    tasks: AggregatedTask[];
    notifications: AppNotification[];
    onToggleTask: (sourceId: string, taskId: string, collection: TaskSourceCollection) => void;
    onNotificationClick: (notification: AppNotification) => void;
    onClose: () => void;
}

const TasksDropdown: React.FC<TasksDropdownProps> = ({ tasks, notifications, onToggleTask, onNotificationClick, onClose }) => {
    
    const groupedTasks = useMemo(() => {
        return tasks.reduce((acc, task) => {
            if (!acc[task.sourceName]) {
                acc[task.sourceName] = [];
            }
            acc[task.sourceName].push(task);
            return acc;
        }, {} as Record<string, AggregatedTask[]>);
    }, [tasks]);

    const { eventNotifications, shiftNotifications } = useMemo(() => {
        const eventNots: SpecialEventNotification[] = [];
        const shiftNots: ShiftUpdateNotification[] = [];
        notifications.forEach(n => {
            if (n.type === 'special_event') {
                eventNots.push(n);
            } else if (n.type === 'shift_update') {
                shiftNots.push(n);
            }
        });
        return { eventNotifications: eventNots, shiftNotifications: shiftNots };
    }, [notifications]);

    const handleNotificationItemClick = (notification: AppNotification) => {
        onNotificationClick(notification);
        onClose();
    };

    const hasContent = tasks.length > 0 || notifications.length > 0;

    return (
        <div 
            className="absolute right-0 mt-2 w-80 origin-top-right bg-gray-900 border border-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
            role="menu"
            aria-orientation="vertical"
        >
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Notificaciones</h3>
                 <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
            </div>

            <div className="py-2 px-1 max-h-96 overflow-y-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
                {hasContent ? (
                    <>
                        {eventNotifications.length > 0 && (
                            <div className="mb-3">
                                <h4 className="px-3 py-1 text-xs font-bold text-purple-400 uppercase">Eventos</h4>
                                <div className="space-y-1 mt-1">
                                    {eventNotifications.map(notification => (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationItemClick(notification)}
                                            className="flex items-start gap-3 p-2 text-sm text-left w-full hover:bg-white/5 rounded-md transition-colors"
                                        >
                                            <StarIcon className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                            <span className="flex-grow text-gray-200">{notification.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {shiftNotifications.length > 0 && (
                             <div className="mb-3">
                                <h4 className="px-3 py-1 text-xs font-bold text-blue-400 uppercase">Turnos</h4>
                                <div className="space-y-1 mt-1">
                                    {shiftNotifications.map(notification => (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationItemClick(notification)}
                                            className="flex items-start gap-3 p-2 text-sm text-left w-full hover:bg-white/5 rounded-md transition-colors"
                                        >
                                            <UsersIcon className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                            <span className="flex-grow text-gray-200">{notification.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {tasks.length > 0 && (
                            <div className="mb-3">
                                <h4 className="px-3 py-1 text-xs font-bold text-orange-400 uppercase">Tareas Pendientes</h4>
                                {Object.keys(groupedTasks).map(sourceName => {
                                    const taskGroup = groupedTasks[sourceName];
                                    return (
                                        <div key={sourceName} className="mt-1">
                                            <h5 className="px-3 py-1 text-xs font-semibold text-gray-400">{sourceName}</h5>
                                            {taskGroup.map(task => (
                                                <div key={task.id} className="flex items-start gap-3 p-2 text-sm text-left w-full hover:bg-white/5 rounded-md transition-colors">
                                                    <button
                                                        onClick={() => onToggleTask(task.sourceId, task.id, task.sourceCollection)}
                                                        className={`w-5 h-5 rounded-md mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors duration-200 border-2 border-gray-500 hover:bg-white/10`}
                                                        aria-label="Marcar como completada"
                                                    >
                                                        <CheckIcon className="w-3 h-3 text-white opacity-0" />
                                                    </button>
                                                    <span className="flex-grow text-gray-200">{task.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 text-gray-400">
                        <BellIcon className="w-8 h-8 mb-2"/>
                        <p className="font-semibold">¡Todo al día!</p>
                        <p className="text-xs">No tienes notificaciones ni tareas pendientes.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TasksDropdown;