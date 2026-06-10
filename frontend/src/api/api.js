const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5001/demo-smartdom/us-central1';

async function apiFetch(path, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Napaka: ${res.status}`);
  return data;
}

// --- Avtentikacija ---
export const registerUser = (email, password, displayName) =>
  apiFetch('register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) });

export const loginUser = (email, password) =>
  apiFetch('login', { method: 'POST', body: JSON.stringify({ email, password }) });

// --- Profil ---
export const getUserProfile = (token) =>
  apiFetch('getUserProfile', {}, token);

export const updateUserProfile = (token, data) =>
  apiFetch('updateUserProfile', { method: 'PUT', body: JSON.stringify(data) }, token);

// --- Naprave ---
export const getDevices = (token) =>
  apiFetch('getDevices', {}, token);

export const addDevice = (token, data) =>
  apiFetch('addDevice', { method: 'POST', body: JSON.stringify(data) }, token);

export const updateDevice = (token, deviceId, data) =>
  apiFetch(`updateDevice?deviceId=${encodeURIComponent(deviceId)}`, {
    method: 'PUT', body: JSON.stringify(data),
  }, token);

export const deleteDevice = (token, deviceId) =>
  apiFetch(`deleteDevice?deviceId=${encodeURIComponent(deviceId)}`, { method: 'DELETE' }, token);

// --- Opozorila ---
export const getAlerts = (token, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`getAlerts${qs ? '?' + qs : ''}`, {}, token);
};

export const markAlertRead = (token, alertId) =>
  apiFetch(`markAlertRead?alertId=${encodeURIComponent(alertId)}`, { method: 'PUT' }, token);

export const markAllAlertsRead = (token) =>
  apiFetch('markAllAlertsRead', { method: 'PUT' }, token);

// --- Senzorji ---
export const getSensorHistory = (token, deviceId, limit = 20) =>
  apiFetch(`getSensorHistory?deviceId=${encodeURIComponent(deviceId)}&limit=${limit}`, {}, token);

// Pošlji senzorske podatke — brez avtentikacije (namenjeno IoT napravam)
export const sendSensorData = (deviceId, type, value, unit) =>
  apiFetch('sendSensorData', {
    method: 'POST',
    body: JSON.stringify({ deviceId, type, value, unit }),
  });

// --- Poročila ---
export const getReports = (token) =>
  apiFetch('getReports', {}, token);

export const triggerReportGeneration = (token) =>
  apiFetch('triggerReportGeneration', { method: 'POST' }, token);
