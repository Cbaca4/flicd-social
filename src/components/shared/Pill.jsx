import React from 'react';
export default function Pill({children,active=false,onClick,tone=''}){return <button className={`pill ${active?'active':''} ${tone}`} onClick={onClick}>{children}</button>}
