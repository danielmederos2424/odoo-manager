// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Add global styles to fix background color issues
const style = document.createElement('style');
style.textContent = `
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: auto;
    background-color: #f5f5f5;
  }
  
  /* Dark mode styles */
  @media (prefers-color-scheme: dark) {
    html, body, #root {
      background-color: #121212;
    }
  }

  /* Ensure content fills the full window */
  #root {
    display: flex;
    flex-direction: column;
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)