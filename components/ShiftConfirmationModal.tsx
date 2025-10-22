import React from 'react';

interface ShiftConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ShiftConfirmationModal: React.FC<ShiftConfirmationModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex justify-center items-center z-50" 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="shift-modal-title"
    >
      <div className="bg-gray-800 border border-white/20 rounded-lg shadow-xl p-6 w-full max-w-md m-4 text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
        <h3 id="shift-modal-title" className="text-xl font-bold text-orange-400 mb-4">Confirmar Cambios</h3>
        <p className="text-gray-300 mb-6">Ha realizado cambios en los turnos. ¿Desea guardarlos? Se notificará a los trabajadores afectados si los cambios son en la semana actual o la siguiente.</p>
        <div className="flex items-center justify-end gap-4">
            <button
                onClick={onCancel}
                className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
                Cancelar
            </button>
            <button
                onClick={onConfirm}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
                Guardar Cambios
            </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftConfirmationModal;
