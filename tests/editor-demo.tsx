import '../styles.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import PdfEditor from '../components/pdf/PdfEditor';
const name = new URLSearchParams(location.search).get('fixture') === 'scan' ? 'scan' : 'native';
const file = new File([await (await fetch(`/tests/fixtures/${name}.pdf`)).arrayBuffer()], `${name}.pdf`, { type: 'application/pdf' });
createRoot(document.getElementById('root')!).render(<React.StrictMode><PdfEditor initialFiles={[file]} onBack={() => location.href = '/'} /></React.StrictMode>);
