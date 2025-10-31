import React from 'react';

const PizzaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 22L2 7a13 13 0 0120 0l-10 15z" />
        <circle cx="12" cy="11" r="1" />
        <circle cx="8" cy="15" r="1" />
        <circle cx="16" cy="15" r="1" />
    </svg>
);

export default PizzaIcon;
