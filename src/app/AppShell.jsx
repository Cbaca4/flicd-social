import React from 'react';
import BottomNav from '../components/navigation/BottomNav.jsx';
import OnboardingGate from '../features/onboarding/OnboardingGate.jsx';

export default function AppShell({ screen, onNavigate, onCapture, children, unread = 0 }) {
  const [ready, setReady] = React.useState(false);
  return <div className="flicd-app"><div className="app-frame"><main className="app-content"><OnboardingGate onReady={() => setReady(true)}>{children}</OnboardingGate>{ready && <BottomNav screen={screen} onNavigate={onNavigate} onCapture={onCapture} unread={unread} />}</main></div></div>;
}
