import React, { useState, useMemo, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, collection } from 'firebase/firestore';
import { db, storage } from '../firebase';
import type { Bookings, Space, SpecialEvent, Task } from '../types';
import { SPACES, TIME_SLOTS } from '../constants';
import { formatDateForBookingKey } from '../utils/dateUtils';
import EventDetailsForm from './views/event/EventDetailsForm';
import EventPosterForm from './views/event/EventPosterForm';
import EventSpaceSelector from './views/event/EventSpaceSelector';
import EventTasksForm from './views/event/EventTasksForm';

interface SpecialEventViewProps {
    bookings: Bookings;
    onSaveEvent: (eventData: SpecialEvent, originalEvent: SpecialEvent | null) => Promise<boolean>;
    onBack: () => void;
    eventToEdit: SpecialEvent | null;
    onEditDone: () => void;
    isReadOnly: boolean;
}

const SpecialEventView: React.FC<SpecialEventViewProps> = ({ bookings, onSaveEvent, onBack, eventToEdit, onEditDone, isReadOnly }) => {
    const [eventName, setEventName] = useState('');
    const [eventStartDate, setEventStartDate] = useState(new Date());
    const [eventEndDate, setEventEndDate] = useState(new Date());
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [observations, setObservations] = useState('');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
    
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
            
            await onSaveEvent(eventData, eventToEdit);
            setIsUploading(false);
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
                <EventDetailsForm
                    eventName={eventName}
                    eventStartDate={eventStartDate}
                    eventEndDate={eventEndDate}
                    observations={observations}
                    onEventNameChange={setEventName}
                    onStartDateChange={handleStartDateChange}
                    onEndDateChange={handleEndDateChange}
                    onObservationsChange={setObservations}
                    isReadOnly={isReadOnly}
                    isUploading={isUploading}
                />
            </div>

            <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                <h3 className="text-xl font-bold text-white border-b border-white/20 pb-3 mb-4">Cartel del Evento (Opcional)</h3>
                <EventPosterForm
                    initialPosterUrl={initialPosterUrl}
                    isPosterMarkedForDeletion={isPosterMarkedForDeletion}
                    posterFile={posterFile}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    onFileChange={handleFileChange}
                    onRemovePoster={handleRemovePoster}
                    isReadOnly={isReadOnly}
                />
            </div>

            <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                <h3 className="text-xl font-bold text-white border-b border-white/20 pb-3 mb-4">Reserva de Espacios (Opcional)</h3>
                <EventSpaceSelector
                    startTime={startTime}
                    endTime={endTime}
                    onStartTimeChange={setStartTime}
                    onEndTimeChange={setEndTime}
                    groupedSpaces={groupedSpaces}
                    spaceStatuses={spaceStatuses}
                    selectedSpaces={selectedSpaces}
                    onSpaceClick={handleSpaceClick}
                    isReadOnly={isReadOnly}
                    isUploading={isUploading}
                />
            </div>
            
            <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg border border-white/10">
                 <h3 className="text-xl font-bold text-white border-b border-white/20 pb-3 mb-4">Tareas Asignables</h3>
                 <EventTasksForm
                    tasks={tasks}
                    newTaskText={newTaskText}
                    newTaskAssignees={newTaskAssignees}
                    onNewTaskTextChange={setNewTaskText}
                    onNewTaskAssigneesChange={setNewTaskAssignees}
                    onAddTask={handleAddTask}
                    onDeleteTask={handleDeleteTask}
                    isReadOnly={isReadOnly}
                    isUploading={isUploading}
                 />
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