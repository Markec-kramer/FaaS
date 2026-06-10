export const formatDate = (ts) => {
  if (!ts) return '-';
  let date;
  if (typeof ts === 'object' && ts !== null) {
    const secs = ts._seconds ?? ts.seconds;
    date = secs !== undefined ? new Date(secs * 1000) : new Date(ts);
  } else {
    date = new Date(ts);
  }
  return isNaN(date.getTime()) ? '-' : date.toLocaleString('sl-SI');
};

export const DEVICE_TYPES = {
  temperature_sensor: { label: 'Temperaturni senzor', icon: '🌡️' },
  humidity_sensor:    { label: 'Senzor vlage',         icon: '💧' },
  motion_sensor:      { label: 'Senzor gibanja',       icon: '👁️' },
  camera:             { label: 'Kamera',               icon: '📷' },
  smart_light:        { label: 'Pametna luč',          icon: '💡' },
  smart_lock:         { label: 'Pametna ključavnica',  icon: '🔒' },
  co2_sensor:         { label: 'CO₂ senzor',           icon: '💨' },
  pressure_sensor:    { label: 'Senzor tlaka',         icon: '📊' },
};

// Konfiguracija za simulator senzorjev — kateri tipi naprav podpirajo pošiljanje podatkov
export const SENSOR_CONFIG = {
  temperature_sensor: {
    dataType: 'temperature',
    unit: '°C',
    defaultValue: 25,
    hint: 'Opozorilo: pod -10°C ali nad 40°C',
    alertExample: 99,
  },
  humidity_sensor: {
    dataType: 'humidity',
    unit: '%',
    defaultValue: 50,
    hint: 'Opozorilo: pod 20% ali nad 80%',
    alertExample: 95,
  },
  co2_sensor: {
    dataType: 'co2',
    unit: 'ppm',
    defaultValue: 400,
    hint: 'Opozorilo: nad 1000 ppm',
    alertExample: 1500,
  },
  pressure_sensor: {
    dataType: 'pressure',
    unit: 'hPa',
    defaultValue: 1013,
    hint: 'Opozorilo: pod 950 ali nad 1050 hPa',
    alertExample: 1100,
  },
  motion_sensor: {
    dataType: 'motion',
    unit: '',
    defaultValue: 0,
    hint: '0 = ni gibanja, 1 = zaznano gibanje',
    alertExample: 1,
  },
};
