import React from 'react'
import ReactDOM from 'react-dom/client'
import App from "./App.jsx";    // <--- ASÍ DEBE SER

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)