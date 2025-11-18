import React from 'react';
import WifiIcon from '../icons/WifiIcon';
import PizzaIcon from '../icons/PizzaIcon';

interface FooterProps {
    onWifiClick: () => void;
}

const Footer: React.FC<FooterProps> = ({ onWifiClick }) => {
    return (
        <footer className="hidden md:flex items-baseline justify-center gap-2 p-4 text-xs text-gray-400 bg-black/20" style={{ fontFamily: 'Arial, sans-serif' }}>
            <span>Gestión THE EMBASSY © 2025 </span>
            <span className="font-caveat text-orange-400 text-xl font-bold">by Manu</span>
            <button
                onClick={onWifiClick}
                className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-orange-400 rounded-full hover:bg-white/10 transition-colors"
                title="Conectar al WiFi"
                aria-label="Conectar al WiFi"
            >
                <WifiIcon className="w-5 h-5" />
            </button>
            <a
                href="https://www.just-eat.es/restaurants-pizzeria-altos-del-higueron-benalmadena/menu?serviceType=delivery&utm_source=google&utm_medium=organic&utm_campaign=foodorder"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-orange-400 rounded-full hover:bg-white/10 transition-colors"
                title="Pedir pizza"
                aria-label="Pedir pizza"
            >
                <PizzaIcon className="w-5 h-5" />
            </a>
        </footer>
    );
};

export default Footer;