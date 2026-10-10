import client from './client';

export function register(payload) {
  return client.post('/auth/register', payload).then((res) => res.data);
}

export function login(payload) {
  return client.post('/auth/login', payload).then((res) => res.data);
}

export function getCurrentUser() {
  return client.get('/auth/me').then((res) => res.data);
}

export function updateProfile(name) {
  return client.patch('/auth/me', { name }).then((res) => res.data);
}

export function updateLanguage(language) {
  return client.patch('/auth/me/language', { language }).then((res) => res.data);
}

export function changePassword(currentPassword, newPassword, confirmPassword) {
  return client.patch('/auth/me/password', { currentPassword, newPassword, confirmPassword }).then((res) => res.data);
}
