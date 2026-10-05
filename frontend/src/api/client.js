import axios from 'axios';

// In dev, requests go to /api and Vite's proxy (see vite.config.js) forwards
// them to the backend on port 4000 — this means the frontend never needs to
// know or care what host/IP it's being viewed from.
const client = axios.create({
  baseURL: '/api',
});

// attach the JWT (if we have one) to every outgoing request
client.interceptors.request.use((config) => {
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
