import React, { useState, useEffect } from 'react';
import './MainContent.css';

function MainContent() {
  const [message, setMessage] = useState('Loading message...');

  useEffect(() => {
    fetch('/api/message')
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(error => {
        console.error('Error fetching message:', error);
        setMessage('Failed to load message.');
      });
  }, []);

  return (
    <main className="app-main">
      <p>Welcome to your new React application.</p>
      <p>{message}</p>
    </main>
  );
}

export default MainContent;