import React from 'react';
import BottomNav from '../components/navigation/BottomNav.jsx';
import OnboardingGate from '../features/onboarding/OnboardingGate.jsx';
import Companion from '../features/companion/Companion.jsx';
import { getActiveSeasonalEvent } from '../features/seasonal/seasonalEvents.js';

export default function AppShell({ userId, screen, onNavigate, onCapture, children, unread = 0, notificationsUnread = 0 }) {
  const [ready, setReady] = React.useState(false);
  const handleReady = React.useCallback(() => setReady(true), []);
  const seasonalEvent = getActiveSeasonalEvent();

  return (
    <div className="flicd-app">
      <div className="app-frame">
        <main className="app-content">
          <OnboardingGate onReady={handleReady}>{children}</OnboardingGate>
          {ready && <Companion userId={userId} enabled seasonalEvent={seasonalEvent} />}
          {ready && <BottomNav screen={screen} onNavigate={onNavigate} onCapture={onCapture} unread={unread} notificationsUnread={notificationsUnread} />}
        </main>
      </div>
    </div>
  );
}
