import App from './components/app/App.js';
import './styles/main.scss';
import './styles/display-specific.css';

// Config is now loaded via HTML script tag

// Set display attribute on body for CSS targeting
const urlParams = new URLSearchParams(window.location.search);
const displayNumber = urlParams.get('display') || '1';
document.body.setAttribute('data-display', displayNumber);
console.log('Set data-display attribute to:', displayNumber);

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Initialize app
const app = new App();
app.init();