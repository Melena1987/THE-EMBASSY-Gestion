import React from 'react';
import XIcon from './icons/XIcon';

interface WifiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WIFI_QR_CODE_URL = 'https://firebasestorage.googleapis.com/v0/b/gestion-theembassy.firebasestorage.app/o/Recursos%2FCaptura%20de%20pantalla%202025-10-20%20094108.png?alt=media&token=cca6c102-a0a2-4a97-b56a-4b25679845da';

const WifiModal: React.FC<WifiModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
        className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex justify-center items-center z-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wifi-modal-title"
        onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-white/20 rounded-lg shadow-xl p-6 w-full max-w-sm m-4 text-white relative"
        style={{ fontFamily: 'Arial, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
            onClick={onClose}
            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Cerrar"
        >
            <XIcon className="w-6 h-6" />
        </button>
        <h3 id="wifi-modal-title" className="text-xl font-bold text-orange-400 mb-4 text-center">Conexión WiFi: THE EMBASSY</h3>
        <p className="text-gray-300 mb-4 text-center">Escanea el código QR para conectarte a nuestra red WiFi.</p>
        <div className="bg-white p-4 rounded-md">
             <img src={WIFI_QR_CODE_URL} alt="QR Code para WiFi THE EMBASSY" className="w-full h-auto" />
        </div>
      </div>
    </div>
  );
};

export default WifiModal;
