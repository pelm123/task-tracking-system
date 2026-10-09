import axios from 'axios';
import { getLang } from '../i18n';

// In dev, requests go to /api and Vite's proxy (see vite.config.js) forwards
// them to the backend on port 4000 — this means the frontend never needs to
// know or care what host/IP it's being viewed from.
const client = axios.create({
  baseURL: '/api',
});

// attach the JWT (if we have one) to every outgoing request, plus the current
// language so the server answers in Thai or English
client.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = getLang();
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// if the API ever says the token is invalid/expired, log the user out
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
