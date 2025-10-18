import React from 'react';

const EmbassyLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 400 50" xmlns="http://www.w3.org/2000/svg" {...props}>
        <text
            fontFamily="Orbitron, sans-serif"
            fontSize="48"
            fontWeight="bold"
            fill="currentColor"
            x="0"
            y="40"
        >
            THE EMBASSY
        </text>
    </svg>
);

export default EmbassyLogo;
