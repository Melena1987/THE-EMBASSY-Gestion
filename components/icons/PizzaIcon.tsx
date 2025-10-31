import React from 'react';

const PizzaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M15 11h.01"/>
        <path d="M11 15h.01"/>
        <path d="M16 16h.01"/>
        <path d="M21.43 11.43 12.57 2.57a1 1 0 0 0-1.42 0L2.57 11.43a1 1 0 0 0 0 1.42l8.86 8.86a1 1 0 0 0 1.42 0l8.86-8.86a1 1 0 0 0 0-1.42Z"/>
        <path d="M9 12a5 5 0 0 1 5-5"/>
    </svg>
);

export default PizzaIcon;