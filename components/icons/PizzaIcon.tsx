import React from 'react';

const PizzaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2 L2 12 L12 22 C 17.5 22 22 17.5 22 12 C 22 6.5 17.5 2 12 2 Z"/>
        <path d="M12 2 V 12 L 22 12"/>
        <path d="M7 7 C 7.5 7.5 8.5 7.5 9 7"/>
        <path d="M6 12 C 6.5 12.5 7.5 12.5 8 12"/>
        <path d="M16 8 C 16.5 8.5 17.5 8.5 18 8"/>
    </svg>
);

export default PizzaIcon;
