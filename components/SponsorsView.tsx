import React, { useState, useEffect, useMemo } from 'react';
import type { Sponsors, Sponsor, Task } from '../types';
import { SPONSOR_ASSIGNEES } from '../constants';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';
import LinkIcon from './icons/LinkIcon';

interface SponsorsViewProps {
    sponsors: Sponsors;
    onUpdateSponsor: (sponsorId: string, newSponsorData: Sponsor) => void;
    onAddSponsor: (sponsorName: string) => Promise<string | null>;
    isReadOnly: boolean;
}

const SponsorsView: React.FC<SponsorsViewProps> = ({ sponsors, onUpdateSponsor, onAddSponsor, isReadOnly }) => {
    const sponsorIds = Object.keys(sponsors);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    
    const [isAdding, setIsAdding] = useState(false);
    const [newSponsorName, setNewSponsorName] = useState('');
    const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);

    useEffect(() => {
        if (!activeTab && sponsorIds.length > 0) {
            setActiveTab(sponsorIds[0]);
        }
         if (activeTab && !sponsorIds.includes(activeTab)) {
            setActiveTab(sponsorIds.length > 0 ? sponsorIds[0] : null);
        }
    }, [sponsorIds, activeTab]);

    const activeSponsor = activeTab ? sponsors[activeTab] : null;

    useEffect(() => {
        if (activeSponsor) {
            setEditingSponsor(activeSponsor);
        } else {
            setEditingSponsor(null);
        }
    }, [activeSponsor]);

    const isDirty = useMemo(() => {
        if (!activeSponsor || !editingSponsor) return false;
        return JSON.stringify(activeSponsor) !== JSON.stringify(editingSponsor);
    }, [activeSponsor, editingSponsor]);
    
    const handleSaveChanges = () => {
        if (editingSponsor && !isReadOnly && isDirty) {
            onUpdateSponsor(editingSponsor.id, editingSponsor);
        }
    };
    
    const handleAddNewSponsor = async () => {
        if (!newSponsorName.trim() || isReadOnly) return;
        const newSponsorId = await onAddSponsor(newSponsorName);
        if (newSponsorId) {
            setNewSponsorName('');
            setIsAdding(false);
            setActiveTab(newSponsorId);
        }
    };
    
    const handleDetailChange = (field: keyof Sponsor, value: string | number) => {
        if (editingSponsor) {
            const parsedValue = field === 'annualContribution' && typeof value === 'string' ? parseFloat(value) || 0 : value;
            setEditingSponsor({ ...editingSponsor, [field]: parsedValue });
        }
    };

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
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-xl font-bold text-white">Gestión de Patrocinadores</h2>
                    {!isReadOnly && !isAdding && (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-green-600 hover:bg-green-700 text-white"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Añadir Patrocinador
                        </button>
                    )}
                </div>
                
                {isAdding && !isReadOnly && (
                     <div className="p-3 bg-black/20 rounded-md space-y-3 mb-4 border border-white/10">
                         <h3 className="text-lg font-semibold text-orange-400">Nuevo Patrocinador</h3>
                         <input 
                             type="text"
                             value={newSponsorName}
                             onChange={(e) => setNewSponsorName(e.target.value)}
                             placeholder="Nombre del nuevo patrocinador"
                             className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"
                         />
                         <div className="flex items-center gap-2">
                             <button onClick={handleAddNewSponsor} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors">Confirmar</button>
                             <button onClick={() => setIsAdding(false)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors">Cancelar</button>
                         </div>
                     </div>
                )}

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

                 <div className="mt-6">
                    {editingSponsor ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Column 1: Sponsor Details */}
                            <fieldset disabled={isReadOnly} className={`space-y-4 ${isReadOnly ? 'opacity-70' : ''}`}>
                                <h3 className="text-lg font-semibold text-orange-400">Ficha de Patrocinador</h3>
                                <div className="space-y-3 bg-black/20 p-4 rounded-md">
                                    <div>
                                        <label htmlFor="allianceDate" className="text-xs text-gray-400 block mb-1">Fecha de alianza</label>
                                        <input id="allianceDate" type="date" value={editingSponsor.allianceDate || ''} onChange={(e) => handleDetailChange('allianceDate', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"/>
                                    </div>
                                    <div>
                                        <label htmlFor="annualContribution" className="text-xs text-gray-400 block mb-1">Importe aportado anual (€)</label>
                                        <input id="annualContribution" type="number" value={editingSponsor.annualContribution || ''} onChange={(e) => handleDetailChange('annualContribution', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" placeholder="0"/>
                                    </div>
                                    <div>
                                        <label htmlFor="contactPhone" className="text-xs text-gray-400 block mb-1">Teléfono de contacto</label>
                                        <input id="contactPhone" type="tel" value={editingSponsor.contactPhone || ''} onChange={(e) => handleDetailChange('contactPhone', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"/>
                                    </div>
                                    <div>
                                        <label htmlFor="instagramUrl" className="text-xs text-gray-400 block mb-1">Cuenta de Instagram</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400"><LinkIcon className="w-4 h-4" /></span>
                                            <input id="instagramUrl" type="text" value={editingSponsor.instagramUrl || ''} onChange={(e) => handleDetailChange('instagramUrl', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 pl-9 focus:ring-orange-500 focus:border-orange-500" placeholder="https://instagram.com/..."/>
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="observations" className="text-xs text-gray-400 block mb-1">Observaciones</label>
                                        <textarea id="observations" value={editingSponsor.observations || ''} onChange={(e) => handleDetailChange('observations', e.target.value)} rows={4} className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 resize-y focus:ring-orange-500 focus:border-orange-500"/>
                                    </div>
                                </div>
                                {!isReadOnly && (
                                    <button onClick={handleSaveChanges} disabled={!isDirty} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isDirty ? 'Guardar Cambios' : 'Guardado'}
                                    </button>
                                )}
                            </fieldset>
                            
                             {/* Column 2: Tasks */}
                            <fieldset disabled={isReadOnly} className={`space-y-4 ${isReadOnly ? 'opacity-70' : ''}`}>
                                <h3 className="text-lg font-semibold text-orange-400">Tareas / Entregables</h3>
                                <div className="space-y-2 bg-black/20 p-4 rounded-md max-h-[400px] overflow-y-auto">
                                    {(editingSponsor.tasks || []).length > 0 ? (
                                        (editingSponsor.tasks || []).map(task => (
                                            <div key={task.id} className="flex items-center gap-3 p-2 bg-black/30 rounded-md">
                                                <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task.id)} className="h-5 w-5 rounded bg-black/40 border-white/30 text-orange-500 focus:ring-orange-500 cursor-pointer flex-shrink-0" disabled={isReadOnly}/>
                                                <span className={`flex-grow text-sm ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.text}</span>
                                                <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full flex-shrink-0">{Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo}</span>
                                                {!isReadOnly && (<button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-white/10 transition-colors flex-shrink-0" title="Eliminar tarea"><TrashIcon className="w-4 h-4" /></button>)}
                                            </div>
                                        ))
                                    ) : ( <p className="text-sm text-gray-500 text-center py-2">No hay tareas para este patrocinador.</p>)}
                                </div>

                                {!isReadOnly && (
                                    <div className="space-y-3 pt-4 border-t border-white/20">
                                        <h4 className="text-md font-semibold text-orange-400">Añadir Nueva Tarea</h4>
                                        <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Descripción de la tarea..." className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"/>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                            <span className="text-sm font-medium text-gray-300">Asignar a:</span>
                                            {SPONSOR_ASSIGNEES.map(w => (
                                                <label key={w} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={newTaskAssignees.includes(w)} onChange={() => handleAssigneeChange(w)} className="h-4 w-4 rounded bg-black/40 border-white/30 text-orange-500 focus:ring-orange-500"/>
                                                    <span className="text-white">{w}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <button onClick={handleAddTask} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors">Añadir Tarea</button>
                                    </div>
                                )}
                            </fieldset>
                        </div>
                    ) : (
                         <p className="text-center text-gray-400 pt-8">
                           {sponsorIds.length > 0 ? 'Seleccione un patrocinador para ver sus detalles.' : 'Añada su primer patrocinador para empezar.'}
                         </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SponsorsView;