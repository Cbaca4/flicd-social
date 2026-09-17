import React from 'react';
import GlobalCompetition from '../competition/GlobalCompetition.jsx';
import Explore from './Explore.jsx';
import PeopleDiscovery from './PeopleDiscovery.jsx';

export default function Discovery({ onToast, onUserSelect }) {
  const [tab, setTab] = React.useState('people');
  return <div className="screen"><div className="topbar"><div><div className="eyebrow">Discovery</div><h1 className="title">Find your next thing</h1><p className="subtitle">Meet people, explore trails, and see what the wider Flic’d community is making.</p></div></div><div className="segmented"><button className={`seg ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>People</button><button className={`seg ${tab === 'explore' ? 'active' : ''}`} onClick={() => setTab('explore')}>Explore</button><button className={`seg ${tab === 'global' ? 'active' : ''}`} onClick={() => setTab('global')}>Global</button></div><div style={{ marginTop: 14 }}>{tab === 'people' ? <PeopleDiscovery onUserSelect={onUserSelect} /> : tab === 'explore' ? <Explore /> : <GlobalCompetition onToast={onToast} />}</div></div>;
}
