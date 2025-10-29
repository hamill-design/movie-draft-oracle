import React from 'react';

export const EnvironmentDebug = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const nodeEnv = import.meta.env.NODE_ENV;
  const mode = import.meta.env.MODE;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      background: 'red', 
      color: 'white', 
      padding: '10px', 
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <div>NODE_ENV: {nodeEnv}</div>
      <div>MODE: {mode}</div>
      <div>SUPABASE_URL: {supabaseUrl ? 'SET' : 'MISSING'}</div>
      <div>SUPABASE_KEY: {supabaseKey ? 'SET' : 'MISSING'}</div>
    </div>
  );
};
