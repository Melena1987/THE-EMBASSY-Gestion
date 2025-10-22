import React, { useState, useMemo, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, collection } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import type { Bookings, Space, SpecialEvent, Task } from '../../types';
import { SPACES, TIME_SLOTS, WORKERS } from '../../constants';
import { formatDateForBookingKey } from '../../utils/dateUtils';
import TrashIcon from '../icons/TrashIcon';

interface SpecialEventViewProps {
    bookings: Bookings;
    onSaveEvent: (eventData: SpecialEvent, originalEvent: SpecialEvent | null) => Promise<boolean>;
    onBack: () => void;
    eventToEdit: SpecialEvent | null;
    onEditDone: () => void;
    isReadOnly: boolean;
    onSelectSpecialEvent: (event: SpecialEvent) => void;
}

const SpecialEventView: React.FC<SpecialEventViewProps> = ({ bookings, onSaveEvent, onBack, eventToEdit, onEditDone, isReadOnly, onSelectSpecialEvent }) => {
    const [eventName, setEventName] = useState('');
    const [eventStartDate, setEventStartDate] = useState(new Date());
    const [eventEndDate, setEventEndDate] = useState(new Date());
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [observations, setObservations] = useState('');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
    
    // State for poster management
    const [posterFile, setPosterFile] = useState<File | null>(null);
    const [initialPosterUrl, setInitialPosterUrl] = useState<string | undefined>();
    const [isPosterMarkedForDeletion, setIsPosterMarkedForDeletion] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    
    useEffect(() => {
        if (eventToEdit) {
            setEventName(eventToEdit.name);
            setEventStartDate(new Date(`${eventToEdit.startDate}T00:00:00`));
            setEventEndDate(new Date(`${eventToEdit.endDate}T00:00:00`));
            setStartTime(eventToEdit.startTime || '');
            setEndTime(eventToEdit.endTime || '');
            setObservations(eventToEdit.observations || '');
            setTasks(eventToEdit.tasks || []);
            setSelectedSpaces(eventToEdit.spaceIds || []);
            setInitialPosterUrl(eventToEdit.posterUrl);
            setPosterFile(null);
            setIsPosterMarkedForDeletion(false);
        }
        return () => {
            if (eventToEdit) onEditDone();
        };
    }, [eventToEdit, onEditDone]);

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateStr = e.target.value;
        if (dateStr) {
            const newStartDate = new Date(`${dateStr}T00:00:00`);
            setEventStartDate(newStartDate);
            if (newStartDate > eventEndDate) {
                setEventEndDate(newStartDate);
            }
        }
    };
    
    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateStr = e.target.value;
        if (dateStr) {
            setEventEndDate(new Date(`${dateStr}T00:00:00`));
        }
    };
    
    const spaceStatuses = useMemo(() => {
        const statuses: { [spaceId: string]: { isBooked: boolean; bookingName?: string } } = {};
        SPACES.forEach(space => statuses[space.id] = { isBooked: false });

        if (!startTime || !endTime || startTime >= endTime || eventStartDate > eventEndDate) return statuses;

        const relevantTimeSlots = TIME_SLOTS.filter(time => time >= startTime && time < endTime);
        
        for (let d = new Date(eventStartDate); d <= eventEndDate; d.setDate(d.getDate() + 1)) {
            const dateStr = formatDateForBookingKey(d);
            const isEditingThisEventOnThisDay = eventToEdit && dateStr >= eventToEdit.startDate && dateStr <= eventToEdit.endDate;

            SPACES.forEach(space => {
                if (statuses[space.id].isBooked) return; // Already found a conflict for this space

                for (const time of relevantTimeSlots) {
                    const key = `${space.id}-${dateStr}-${time}`;
                    if (bookings[key]) {
                        if (bookings[key].name.startsWith('EVENTO:')) continue;

                        const isOwnBooking = isEditingThisEventOnThisDay &&
                                             eventToEdit!.spaceIds?.includes(space.id) &&
                                             eventToEdit!.startTime && eventToEdit!.endTime &&
                                             time >= eventToEdit!.startTime &&
                                             time < eventToEdit!.endTime;
                        if (!isOwnBooking) {
                            statuses[space.id] = { isBooked: true, bookingName: bookings[key].name };
                            break;
                        }
                    }
                }
            });
        }
        return statuses;
    }, [bookings, eventStartDate, eventEndDate, startTime, endTime, eventToEdit]);


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

     const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPosterFile(e.target.files[0]);
            setIsPosterMarkedForDeletion(false);
        }
    };

    const handleRemovePoster = () => {
        setIsPosterMarkedForDeletion(true);
        setPosterFile(null);
    };

    const handleSave = async () => {
        if (!eventName.trim()) {
            alert("El nombre del evento no puede estar vacío.");
            return;
        }
         if (eventEndDate < eventStartDate) {
            alert("La fecha de fin no puede ser anterior a la fecha de inicio.");
            return;
        }
        if ((startTime || endTime || selectedSpaces.length > 0) && (!startTime || !endTime || startTime >= endTime)) {
            alert("Para reservar espacios, debe seleccionar una hora de inicio y fin válida.");
            return;
        }

        const eventId = eventToEdit?.id || doc(collection(db, 'specialEvents')).id;
        let finalPosterUrl = initialPosterUrl;

        // Step 1: Handle poster deletion if marked
        if (isPosterMarkedForDeletion && initialPosterUrl) {
            try {
                const oldPosterRef = ref(storage, initialPosterUrl);
                await deleteObject(oldPosterRef);
                finalPosterUrl = undefined;
            } catch (error) {
                console.warn("Could not delete old poster, it may have already been removed.", error);
            }
        }

        const processAndSaveEvent = async (posterUrl?: string) => {
            const eventData: SpecialEvent = {
                id: eventId,
                name: eventName.trim(),
                startDate: formatDateForBookingKey(eventStartDate),
                endDate: formatDateForBookingKey(eventEndDate),
                ...(observations.trim() && { observations: observations.trim() }),
                ...(tasks && tasks.length > 0 && { tasks: tasks }),
                ...(startTime && { startTime: startTime }),
                ...(endTime && { endTime: endTime }),
                ...(selectedSpaces.length > 0 && { spaceIds: selectedSpaces }),
                ...(posterUrl && { posterUrl: posterUrl }),
            };
            
            const success = await onSaveEvent(eventData, eventToEdit);
            setIsUploading(false);
            if(success) {
                onSelectSpecialEvent(eventData);
            }
        };
        
        // Step 2: Handle new poster upload
        if (posterFile) {
            setIsUploading(true);
            setUploadProgress(0);
            
            // If replacing an existing poster that wasn't marked for deletion, delete it now.
            if (!isPosterMarkedForDeletion && initialPosterUrl) {
                try {
                    const oldPosterRef = ref(storage, initialPosterUrl);
                    await deleteObject(oldPosterRef);
                } catch (error) {
                    console.warn("Could not delete old poster during replacement.", error);
                }
            }

            const fileExtension = posterFile.name.split('.').pop();
            const storageRef = ref(storage, `events/${eventId}/poster.${fileExtension}`);
            const uploadTask = uploadBytesResumable(storageRef, posterFile);

            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => {
                    console.error("Upload failed:", error);
                    alert("La subida del cartel falló.");
                    setIsUploading(false);
                },
                async () => {
                    finalPosterUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    await processAndSaveEvent(finalPosterUrl);
                }
            );
        } else {
            // Step 3: No new file, just save other data with potentially updated poster URL (if it was deleted)
            await processAndSaveEvent(finalPosterUrl);
        }
    };
    
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
                <fieldset disabled={isReadOnly || isUploading} className={`space-y-4 ${isReadOnly || isUploading ? 'opacity-70' : ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div>
                            <label htmlFor="eventName" className="text-xs text-gray-400 block mb-1">Nombre del Evento</label>
                            <input id="eventName" type="text" value={eventName} onChange={e => setEventName(e.target.value)} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                        <div>
                            <label htmlFor="eventStartDate" className="text-xs text-gray-400 block mb-1">Fecha de Inicio</label>
                            <input id="eventStartDate" type="date" value={formatDateForBookingKey(eventStartDate)} onChange={handleStartDateChange} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                         <div>
                            <label htmlFor="eventEndDate" className="text-xs text-gray-400 block mb-1">Fecha de Fin</label>
                            <input id="eventEndDate" type="date" value={formatDateForBookingKey(eventEndDate)} min={formatDateForBookingKey(eventStartDate)} onChange={handleEndDateChange} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="eventObservations" className="text-xs text-gray-400 block mb-1">Observaciones</label>
                        <textarea id="eventObservations" value={observations} onChange={e => setObservations(e.target.value)} rows={3} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 resize-y focus:ring-orange-500 focus:border-orange-500" />
                    </div>
                </fieldset>
            </div>

             <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                <h3 className="text-xl font-bold text-white border-b border-white/20 pb-3 mb-4">Cartel del Evento (Opcional)</h3>
                <fieldset disabled={isReadOnly || isUploading} className={`space-y-4 ${isReadOnly || isUploading ? 'opacity-70' : ''}`}>
                    {initialPosterUrl && !isPosterMarkedForDeletion && !posterFile && (
                        <div>
                            <p className="text-sm text-gray-400 mb-2">Cartel actual:</p>
                            <div className="flex items-center gap-4 p-2 bg-black/20 rounded-md">
                                <a href={initialPosterUrl} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Ver Cartel</a>
                                <button onClick={handleRemovePoster} className="text-red-400 hover:text-red-300" title="Eliminar cartel">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                     <div>
                        <label htmlFor="posterFile" className="text-xs text-gray-400 block mb-1">{initialPosterUrl ? 'Reemplazar' : 'Subir'} cartel (PDF o Imagen)</label>
                        <input id="posterFile" type="file" onChange={handleFileChange} accept="image/*,application/pdf" className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700"/>
                        {posterFile && <p className="text-xs text-gray-400 mt-1">Seleccionado: {posterFile.name}</p>}
                    </div>
                    {isUploading && (
                         <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    )}
                </fieldset>
            </div>

            <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                <h3 className="text-xl font-bold text-white border-b border-white/20 pb-3 mb-4">Reserva de Espacios (Opcional)</h3>
                 <fieldset disabled={isReadOnly || isUploading} className={`space-y-4 ${isReadOnly || isUploading ? 'opacity-70' : ''}`}>
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
                    {/* FIX: The error indicates a type inference issue with `Object.entries`. Rewriting the loop using `Object.keys` is a safer way to iterate and ensure correct types. */}
                    {Object.keys(groupedSpaces).map((group) => {
                        const spaces = groupedSpaces[group];
                        return (
                            <div key={group}>
                                 <h4 className="text-lg font-semibold text-orange-400 mt-4 mb-2">{group}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {spaces.map(space => {
                                    const { isBooked, bookingName } = spaceStatuses[space.id] || {};
                                    const isSelected = selectedSpaces.includes(space.id);
                                    return (
                                    <button key={space.id} onClick={() => handleSpaceClick(space.id)} disabled={isReadOnly}
                                        title={isBooked ? `Reserva '${bookingName}' será ELIMINADA al guardar.` : space.name}
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
                        );
                    })}
                 </fieldset>
            </div>
            
            <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                 <h3 className="text-xl font-bold text-white border-b border-white/20 pb-3 mb-4">Tareas Asignables</h3>
                 <fieldset disabled={isReadOnly || isUploading} className={`space-y-4 ${isReadOnly || isUploading ? 'opacity-70' : ''}`}>
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
                                <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full">{Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo}</span>
                                <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                 </fieldset>
            </div>
            
            <div className="flex justify-between items-center mt-6">
                <button onClick={onBack} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md">&larr; Volver</button>
                {!isReadOnly && (
                    <button onClick={handleSave} disabled={isUploading} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md disabled:opacity-50 disabled:cursor-wait">
                        {isUploading ? `Subiendo... ${uploadProgress.toFixed(0)}%` : (eventToEdit ? 'Guardar Cambios' : 'Crear Evento')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default SpecialEventView;