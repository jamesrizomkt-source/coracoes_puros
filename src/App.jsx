import React from 'react';
import { Routes, Route } from 'react-router-dom';

// We will create these pages next
import Landing from './pages/Landing';
import Admin from './pages/Admin';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin/*" element={<Admin />} />
    </Routes>
  );
}

export default App;
