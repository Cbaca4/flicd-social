import React from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import './mobile.css';
import './features/companion/CompanionCostume.css';
import FlicdApp from './app/FlicdApp.jsx';
createRoot(document.getElementById('root')).render(<React.StrictMode><FlicdApp/></React.StrictMode>);
