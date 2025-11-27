import React, { useMemo } from 'react';
// FIX: Corrected import path for types and added new types for notifications.
import type { AppNotification, TaskSourceCollection, AggregatedTask, SpecialEventNotification, ShiftUpdateNotification, VacationUpdateNotification } from '../../types';
// FIX: Corrected import paths for icons.
import CheckIcon from '../icons/CheckIcon';
import BellIcon from '../icons/BellIcon';
import StarIcon from '../icons/StarIcon';
import UsersIcon from '../icons/UsersIcon';
import CalendarCheckIcon from '../icons/CalendarCheckIcon';

// FIX: Updated props to include notifications and a click handler for them.
interface TasksDropdownProps {
    tasks: AggregatedTask[];
    notifications: AppNotification[];
    onToggleTask: (sourceId: string, taskId: string, collection: TaskSourceCollection) => void;
    onNotificationClick: (notification: AppNotification) => void;
    onClose: () => void;
    onMarkAllAsRead: () => void;
}

const TasksDropdown: React.FC<TasksDropdownProps> = ({ tasks, notifications, onToggleTask, onNotificationClick, onClose, onMarkAllAsRead }) => {
    
    const groupedTasks = useMemo(() => {
        return tasks.reduce((acc, task) => {
            if (!acc[task.sourceName]) {
                acc[task.sourceName] = [];
            }
            acc[task.sourceName].push(task);
            return acc;
        }, {} as Record<string, AggregatedTask[]>);
    }, [tasks]);

    const { eventNotifications, shiftNotifications, vacationNotifications } = useMemo(() => {
        const eventNots: SpecialEventNotification[] = [];
        const shiftNots: ShiftUpdateNotification[] = [];
        const vacationNots: VacationUpdateNotification[] = [];
        notifications.forEach(n => {
            if (n.type === 'special_event') {
                eventNots.push(n);
            } else if (n.type === 'shift_update') {
                shiftNots.push(n);
            } else if (n.type === 'vacation_update') {
                vacationNots.push(n as VacationUpdateNotification);
            }
        });
        return { eventNotifications: eventNots, shiftNotifications: shiftNots, vacationNotifications: vacationNots };
    }, [notifications]);

    const handleNotificationItemClick = (notification: AppNotification) => {
        onNotificationClick(notification);
        onClose();
    };

    const hasContent = tasks.length > 0 || notifications.length > 0;
    const hasNotifications = eventNotifications.length > 0 || shiftNotifications.length > 0 || vacationNotifications.length > 0;

    return (
        <div 
            className="absolute right-0 mt-2 w-80 origin-top-right bg-gray-900 border border-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
            role="menu"
            aria-orientation="vertical"
        >
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Notificaciones</h3>
                <div className="flex items-center gap-2">
                    {hasNotifications && (
                        <button 
                            onClick={onMarkAllAsRead}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium underline decoration-blue-400/50 hover:decoration-blue-300"
                            title="Marcar todas como leídas"
                        >
                            Marcar todo leído
                        </button>
                    )}
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
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
                         {vacationNotifications.length > 0 && (
                             <div className="mb-3">
                                <h4 className="px-3 py-1 text-xs font-bold text-green-400 uppercase">Vacaciones</h4>
                                <div className="space-y-1 mt-1">
                                    {vacationNotifications.map(notification => (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationItemClick(notification)}
                                            className="flex items-start gap-3 p-2 text-sm text-left w-full hover:bg-white/5 rounded-md transition-colors"
                                        >
                                            <CalendarCheckIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
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