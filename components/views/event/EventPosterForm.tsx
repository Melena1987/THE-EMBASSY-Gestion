import React from 'react';
import TrashIcon from '../../icons/TrashIcon';

interface EventPosterFormProps {
    initialPosterUrl?: string;
    isPosterMarkedForDeletion: boolean;
    posterFile: File | null;
    isUploading: boolean;
    uploadProgress: number;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemovePoster: () => void;
    isReadOnly: boolean;
}

const EventPosterForm: React.FC<EventPosterFormProps> = ({
    initialPosterUrl,
    isPosterMarkedForDeletion,
    posterFile,
    isUploading,
    uploadProgress,
    onFileChange,
    onRemovePoster,
    isReadOnly,
}) => {
    return (
        <fieldset disabled={isReadOnly || isUploading} className={`space-y-4 ${isReadOnly || isUploading ? 'opacity-70' : ''}`}>
            {initialPosterUrl && !isPosterMarkedForDeletion && !posterFile && (
                <div>
                    <p className="text-sm text-gray-400 mb-2">Cartel actual:</p>
                    <div className="flex items-center gap-4 p-2 bg-black/20 rounded-md">
                        <a href={initialPosterUrl} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Ver Cartel</a>
                        <button onClick={onRemovePoster} className="text-red-400 hover:text-red-300" title="Eliminar cartel">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
            <div>
                <label htmlFor="posterFile" className="text-xs text-gray-400 block mb-1">{initialPosterUrl ? 'Reemplazar' : 'Subir'} cartel (PDF o Imagen)</label>
                <input id="posterFile" type="file" onChange={onFileChange} accept="image/*,application/pdf" className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700" />
                {posterFile && <p className="text-xs text-gray-400 mt-1">Seleccionado: {posterFile.name}</p>}
            </div>
            {isUploading && (
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                </div>
            )}
        </fieldset>
    );
};

export default EventPosterForm;
