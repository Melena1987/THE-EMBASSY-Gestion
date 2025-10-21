import React from 'react';
import WifiIcon from '../icons/WifiIcon';

interface FooterProps {
    onWifiClick: () => void;
}

const Footer: React.FC<FooterProps> = ({ onWifiClick }) => {
    return (
        <footer className="flex items-baseline justify-center gap-2 p-4 text-xs text-gray-400 bg-black/20" style={{ fontFamily: 'Arial, sans-serif' }}>
            <span>Gestión THE EMBASSY © 2025 </span>
            <span className="text-orange-400" style={{ fontFamily: 'Caveat, cursive', fontSize: '1.25rem', fontWeight: 'bold' }}>by Manu</span>
            <button
                onClick={onWifiClick}
                className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-orange-400 rounded-full hover:bg-white/10 transition-colors"
                title="Conectar al WiFi"
                aria-label="Conectar al WiFi"
            >
                <WifiIcon className="w-5 h-5" />
            </button>
        </footer>
    );
};

export default Footer;
