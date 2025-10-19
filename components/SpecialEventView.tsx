
import React, { useState, useMemo, useEffect } from 'react';
import type { Bookings, Space, SpecialEvent, Task } from '../types';
import { SPACES, TIME_SLOTS, WORKERS } from '../constants';
import { formatDateForBookingKey } from '../utils/dateUtils';
import TrashIcon from './icons/TrashIcon';

interface SpecialEventViewProps {
    bookings: Bookings;
    onSaveEvent: (eventData: SpecialEvent, originalEventId?: string) => Promise<boolean>;
    onBack: () => void;
    eventToEdit: SpecialEvent | null;
    onEditDone: () => void;
    isReadOnly: boolean;
}

const SpecialEventView: React.FC<SpecialEventViewProps> = ({ bookings, onSaveEvent, onBack, eventToEdit, onEditDone, isReadOnly }) => {
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState(new Date());
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [observations, setObservations] = useState('');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);

    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    
    useEffect(() => {
        if (eventToEdit) {
            setEventName(eventToEdit.name);
            setEventDate(new Date(`${eventToEdit.id}T00:00:00`));
            setStartTime(eventToEdit.startTime || '');
            setEndTime(eventToEdit.endTime || '');
            setObservations(eventToEdit.observations || '');
            setTasks(eventToEdit.tasks || []);
            setSelectedSpaces(eventToEdit.spaceIds || []);
        }
        return () => {
            if (eventToEdit) onEditDone();
        };
    }, [eventToEdit, onEditDone]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateStr = e.target.value;
        if (dateStr) {
            setEventDate(new Date(`${dateStr}T00:00:00`));
        }
    };
    
    const spaceStatuses = useMemo(() => {
        const statuses: { [spaceId: string]: { isBooked: boolean; bookingName?: string } } = {};
        SPACES.forEach(space => statuses[space.id] = { isBooked: false });

        if (!startTime || !endTime || startTime >= endTime) return statuses;

        const relevantTimeSlots = TIME_SLOTS.filter(time => time >= startTime && time < endTime);
        const dateStr = formatDateForBookingKey(eventDate);
        
        const isEditingThisEvent = eventToEdit && eventToEdit.id === dateStr;

        SPACES.forEach(space => {
            for (const time of relevantTimeSlots) {
                const key = `${space.id}-${dateStr}-${time}`;
                if (bookings[key]) {
                    if (bookings[key].name.startsWith('EVENTO:')) continue;

                    const isOwnBooking = isEditingThisEvent &&
                                         eventToEdit.spaceIds?.includes(space.id) &&
                                         eventToEdit.startTime && eventToEdit.endTime &&
                                         time >= eventToEdit.startTime &&
                                         time < eventToEdit.endTime;
                    if (!isOwnBooking) {
                        statuses[space.id] = { isBooked: true, bookingName: bookings[key].name };
                        break;
                    }
                }
            }
        });
        return statuses;
    }, [bookings, eventDate, startTime, endTime, eventToEdit]);

    const handleSpaceClick = (spaceId: string) => {
        setSelectedSpaces(prev => prev.includes(spaceId) ? prev.filter(id => id !== spaceId) : [...prev, spaceId]);
    };

    const handleAssigneeChange = (worker: string) => {
        setNewTaskAssignees(prev => prev.includes(worker) ? prev.filter(w => w !== worker) : [...prev, worker]);
    };

    const handleAddTask = () => {
        if (!newTaskText.trim() || newTaskAssignees.length === 0) return;
        const newTask: Task = { id: Date.now().toString(), text: newTaskText.trim(), assignedTo: newTaskAssignees, completed: false };
        setTasks(prev => [...prev, newTask]);
        setNewTaskText('');
        setNewTaskAssignees([]);
    };

    const handleDeleteTask = (taskId: string) => {
        setTasks(prev => prev.filter(task => task.id !== taskId));
    };

    const handleSave = async () => {
        if (!eventName.trim()) {
            alert("El nombre del evento no puede estar vacío.");
            return;
        }
        if ((startTime || endTime || selectedSpaces.length > 0) && (!startTime || !endTime || startTime >= endTime)) {
            alert("Para reservar espacios, debe seleccionar una hora de inicio y fin válida.");
            return;
        }

        const eventData: SpecialEvent = {
            id: formatDateForBookingKey(eventDate),
            name: eventName.trim(),
            observations: observations.trim() || undefined,
            tasks: tasks.length > 0 ? tasks : undefined,
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            spaceIds: selectedSpaces.length > 0 ? selectedSpaces : undefined,
        };
        
        const success = await onSaveEvent(eventData, eventToEdit?.id);
        if (success) {
            // State will be cleared by unmounting or navigating away
        }
    };
    
    // FIX: Replaced complex `reduce` with a clearer, more type-safe loop to avoid type inference issues with `Object.entries`.
    const groupedSpaces = useMemo(() => {
        const groups: Record<string, Space[]> = {};
        for (const space of SPACES) {
            if (!groups[space.group]) {
                groups[space.group] = [];
            }
            groups[space.group].push(space);
        }
        return groups;
    }, []);

    return (
        <div className="space-y-6 max-w-7xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                 <h2 className="text-2xl font-bold text-white border-b border-white/20 pb-3 mb-4">{eventToEdit ? 'Editar' : 'Crear'} Evento Especial</h2>
                <fieldset disabled={isReadOnly} className={`space-y-4 ${isReadOnly ? 'opacity-70' : ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="md:col-span-2">
                            <label htmlFor="eventName" className="text-xs text-gray-400 block mb-1">Nombre del Evento</label>
                            <input id="eventName" type="text" value={eventName} onChange={e => setEventName(e.target.value)} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                        <div>
                            <label htmlFor="eventDate" className="text-xs text-gray-400 block mb-1">Fecha del Evento</label>
                            <input id="eventDate" type="date" value={formatDateForBookingKey(eventDate)} onChange={handleDateChange} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="eventObservations" className="text-xs text-gray-400 block mb-1">Observaciones</label>
                        <textarea id="eventObservations" value={observations} onChange={e => setObservations(e.target.value)} rows={3} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 resize-y focus:ring-orange-500 focus:border-orange-500" />
                    </div>
                </fieldset>
            </div>

            <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                <h3 className="text-xl font-bold text-white border-b border-white/20 pb-3 mb-4">Reserva de Espacios (Opcional)</h3>
                 <fieldset disabled={isReadOnly} className={`space-y-4 ${isReadOnly ? 'opacity-70' : ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="startTime" className="text-xs text-gray-400 block mb-1">Hora de inicio</label>
                            <input id="startTime" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" step="1800" />
                        </div>
                        <div>
                            <label htmlFor="endTime" className="text-xs text-gray-400 block mb-1">Hora de fin</label>
                            <input id="endTime" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" step="1800" />
                        </div>
                    </div>
                    {Object.entries(groupedSpaces).map(([group, spaces]) => (
                        <div key={group}>
                             <h4 className="text-lg font-semibold text-orange-400 mt-4 mb-2">{group}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {spaces.map(space => {
                                const { isBooked, bookingName } = spaceStatuses[space.id] || {};
                                const isSelected = selectedSpaces.includes(space.id);
                                return (
                                <button key={space.id} onClick={() => handleSpaceClick(space.id)} disabled={isReadOnly}
                                    title={isBooked ? `Este espacio está reservado por '${bookingName}'. Al guardar, se eliminará esa reserva.` : space.name}
                                    className={`p-3 rounded-md text-sm font-medium transition-all h-20 flex items-center justify-center text-center ${
                                        isSelected ? 'bg-blue-600 ring-2 ring-white' : 'bg-black/20 hover:bg-black/40'
                                    } ${
                                        isBooked ? 'border-2 border-red-500' : ''
                                    } ${
                                        isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'
                                    }`}>
                                    {isBooked ? `SOBRESCRIBIR: ${bookingName}` : space.name}
                                </button>
                                );
                            })}
                            </div>
                        </div>
                    ))}
                 </fieldset>
            </div>
            
            <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                 <h3 className="text-xl font-bold text-white border-b border-white/20 pb-3 mb-4">Tareas Asignables</h3>
                 <fieldset disabled={isReadOnly} className={`space-y-4 ${isReadOnly ? 'opacity-70' : ''}`}>
                    <div className="p-3 bg-black/20 rounded-md space-y-3">
                        <input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Descripción de la tarea..." className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"/>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <span className="text-sm font-medium text-gray-300">Asignar a:</span>
                            {WORKERS.map(w => (
                                <label key={w} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={newTaskAssignees.includes(w)} onChange={() => handleAssigneeChange(w)} className="h-4 w-4 rounded bg-black/40 border-white/30 text-orange-500 focus:ring-orange-500"/>
                                    <span className="text-white">{w}</span>
                                </label>
                            ))}
                        </div>
                        <button onClick={handleAddTask} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-md">Añadir Tarea</button>
                    </div>
                     <div className="space-y-2">
                        {tasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
                                <span className="flex-grow text-gray-200">{task.text}</span>
                                <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full">{task.assignedTo.join(', ')}</span>
                                <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                 </fieldset>
            </div>
            
            <div className="flex justify-between items-center mt-6">
                <button onClick={onBack} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md">&larr; Volver</button>
                {!isReadOnly && (
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md">{eventToEdit ? 'Guardar Cambios' : 'Crear Evento'}</button>
                )}
            </div>
        </div>
    );
};

export default SpecialEventView;
