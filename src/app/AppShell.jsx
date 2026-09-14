import React from 'react';
import BottomNav from '../components/navigation/BottomNav.jsx';
export default function AppShell({screen,onNavigate,onCapture,children,unread=0}){return <div className="flicd-app"><div className="app-frame"><main className="app-content">{children}<BottomNav screen={screen} onNavigate={onNavigate} onCapture={onCapture} unread={unread}/></main></div></div>}
