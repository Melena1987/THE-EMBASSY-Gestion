import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirmSingle: () => void;
  onConfirmFuture: () => void;
  onClose: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, title, message, onConfirmSingle, onConfirmFuture, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex justify-center items-center z-50" 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="modal-title"
    >
      <div className="bg-gray-800 border border-white/20 rounded-lg shadow-xl p-6 w-full max-w-md m-4 text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
        <h3 id="modal-title" className="text-xl font-bold text-orange-400 mb-4">{title}</h3>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex flex-col space-y-3">
            <button
                onClick={onConfirmSingle}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
                Solo este evento
            </button>
            <button
                onClick={onConfirmFuture}
                className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
                Este y todos los eventos futuros
            </button>
            <button
                onClick={onClose}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors mt-2"
            >
                Cancelar
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
