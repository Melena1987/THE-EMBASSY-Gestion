import React from 'react';
import type { SpecialEvent, TaskSourceCollection } from '../../types';
import { SPACES } from '../../constants';
import TrashIcon from '../icons/TrashIcon';
import PencilIcon from '../icons/PencilIcon';
import CheckIcon from '../icons/CheckIcon';
import StarIcon from '../icons/StarIcon';

interface SpecialEventDetailsViewProps {
    event: SpecialEvent;
    onBack: () => void;
    onEdit: () => void;
    onDelete: (event: SpecialEvent) => void;
    onToggleTask: (sourceId: string, taskId: string, collectionName: TaskSourceCollection) => void;
    canEdit: boolean;
}

const SpecialEventDetailsView: React.FC<SpecialEventDetailsViewProps> = ({ event, onBack, onEdit, onDelete, onToggleTask, canEdit }) => {
    
    const [startYear, startMonth, startDay] = event.startDate.split('-').map(Number);
    const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const formattedStartDate = startDateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

    const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number);
    const endDateObj = new Date(Date.UTC(endYear, endMonth - 1, endDay));
    const formattedEndDate = endDateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    
    const formattedDate = event.startDate === event.endDate 
        ? formattedStartDate 
        : `Del ${formattedStartDate} al ${formattedEndDate}`;

    const allSpaceIdsCount = SPACES.length;
    const bookedSpacesNames = event.spaceIds && event.spaceIds.length > 0
        ? (event.spaceIds.length === allSpaceIdsCount ? 'TODA LA INSTALACIÓN' : event.spaceIds.map(id => SPACES.find(s => s.id === id)?.name || id).join(', '))
        : 'Ninguno';
    
    const posterUrl = event.posterUrl;
    const isImage = posterUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(posterUrl);

    return (
        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg max-w-4xl mx-auto border border-white/10" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex items-center gap-4 mb-4 border-b border-white/20 pb-2">
                <StarIcon className="w-8 h-8 text-purple-400" />
                <h2 className="text-2xl font-bold text-purple-300">Detalles del Evento Especial</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                    <p><strong className="text-gray-400 w-28 inline-block">Nombre:</strong> <span className="text-white text-lg font-semibold">{event.name}</span></p>
                    <p><strong className="text-gray-400 w-28 inline-block">Fecha:</strong> <span className="text-white">{formattedDate}</span></p>
                    <p><strong className="text-gray-400 w-28 inline-block">Horario:</strong> <span className="text-white">{event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : 'No especificado'}</span></p>
                    <p><strong className="text-gray-400 w-28 inline-block">Espacios:</strong> <span className="text-white capitalize">{bookedSpacesNames}</span></p>
                </div>
                
                {posterUrl && (
                    <div className="row-span-2 flex flex-col items-center">
                        <strong className="text-gray-400 block mb-2">Cartel del Evento:</strong>
                        <a href={posterUrl} target="_blank" rel="noopener noreferrer" className="block">
                            {isImage ? (
                                <img src={posterUrl} alt={`Cartel de ${event.name}`} className="max-w-xs max-h-60 rounded-md object-contain border border-white/20 hover:opacity-80 transition-opacity" />
                            ) : (
                                <div className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">
                                    Ver Cartel (PDF)
                                </div>
                            )}
                        </a>
                    </div>
                )}

                {event.observations && (
                    <div className="md:col-span-2">
                        <strong className="text-gray-400 block mb-1">Observaciones:</strong>
                        <p className="text-white bg-black/20 p-3 rounded-md mt-1 whitespace-pre-wrap">{event.observations}</p>
                    </div>
                )}

                {event.tasks && event.tasks.length > 0 && (
                     <div className="md:col-span-2">
                        <strong className="text-gray-400 block mb-2">Tareas del Evento:</strong>
                        <div className="space-y-2">
                            {event.tasks.map(task => (
                                <div key={task.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-md">
                                    <button
                                        onClick={() => onToggleTask(event.id, task.id, 'specialEvents')}
                                        className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors duration-200 ${ task.completed ? 'bg-green-500 hover:bg-green-600' : 'border-2 border-gray-500 hover:bg-white/10' }`}
                                    >
                                        {task.completed && <CheckIcon className="w-3 h-3 text-white" />}
                                    </button>
                                    <span className={`flex-grow ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.text}</span>
                                    <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full">{Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button onClick={onBack} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors">&larr; Volver</button>
                {canEdit && (
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={onEdit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2"><PencilIcon className="w-5 h-5" />Editar</button>
                        <button onClick={() => onDelete(event)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2"><TrashIcon className="w-5 h-5" />Eliminar</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpecialEventDetailsView;
