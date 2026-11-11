import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import '../../src/mobile.css';
import FlicdApp from '../../src/app/FlicdApp.jsx';
createRoot(document.getElementById('root')).render(<React.StrictMode><FlicdApp/></React.StrictMode>);
