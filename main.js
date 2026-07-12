import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { occursOn, isDoneOn } from './recurrence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(app.getPath('userData'), 'reminders.json');
const monthlyDataPath = path.join(app.getPath('userData'), 'monthlyReminders.json');

function loadReminders() {
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveReminders(reminders) {
  fs.writeFileSync(dataPath, JSON.stringify(reminders, null, 2));
}

function loadMonthlyReminders() {
  try {
    const raw = fs.readFileSync(monthlyDataPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveMonthlyReminders(reminders) {
  fs.writeFileSync(monthlyDataPath, JSON.stringify(reminders, null, 2));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function fireNotification(r, onClick) {
  const notification = new Notification({
    title: r.name,
    body: r.info || 'Reminder!',
    timeoutType: 'never'
  });
  notification.on('click', onClick);
  notification.show();
}

let mainWindow = null;

// Cloud reminders live in Firestore, not the local file, so the renderer pushes
// its live copy here whenever it changes (see 'cloud-reminders-updated').
let cloudReminders = [];
let cloudMonthlyReminders = [];
// Guards against re-notifying while waiting for the Firestore round-trip that
// persists lastNotified back to the cloud reminder (see 'mark-cloud-notified').
const cloudNotifiedGuard = new Map(); // id -> "YYYY-MM-DD"
const cloudMonthlyNotifiedGuard = new Map(); // id -> "YYYY-MM-DD"

function checkReminders() {
  const reminders = loadReminders();
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
  const today = todayStr();
  let changed = false;

  reminders.forEach(r => {
    const alreadyDoneToday = r.doneDate === today;
    const alreadyNotifiedToday = r.lastNotified === today;

    if (r.time === currentTime && !alreadyDoneToday && !alreadyNotifiedToday) {
      fireNotification(r, () => {
        const reminders = loadReminders();
        const target = reminders.find(x => x.id === r.id);
        if (target) {
          target.doneDate = today;
          saveReminders(reminders);
        }
      });

      r.lastNotified = today;
      changed = true;
    }
  });

  if (changed) saveReminders(reminders);

  cloudReminders.forEach(r => {
    const alreadyDoneToday = r.doneDate === today;
    const alreadyNotifiedToday = r.lastNotified === today || cloudNotifiedGuard.get(r.id) === today;

    if (r.time === currentTime && !alreadyDoneToday && !alreadyNotifiedToday) {
      fireNotification(r, () => {
        mainWindow?.webContents.send('mark-cloud-done', r.id);
      });

      cloudNotifiedGuard.set(r.id, today);
      mainWindow?.webContents.send('mark-cloud-notified', r.id);
    }
  });

  checkMonthlyReminders(currentTime, today);
}

function checkMonthlyReminders(currentTime, today) {
  const monthlyReminders = loadMonthlyReminders();
  let changed = false;

  monthlyReminders.forEach(r => {
    const occursToday = occursOn(r, today);
    const alreadyDoneToday = isDoneOn(r, today);
    const alreadyNotifiedToday = r.lastNotified === today;

    if (occursToday && r.time === currentTime && !alreadyDoneToday && !alreadyNotifiedToday) {
      fireNotification(r, () => {
        const monthlyReminders = loadMonthlyReminders();
        const target = monthlyReminders.find(x => x.id === r.id);
        if (target) {
          if (!Array.isArray(target.completedDates)) target.completedDates = [];
          if (!target.completedDates.includes(today)) target.completedDates.push(today);
          saveMonthlyReminders(monthlyReminders);
        }
      });

      r.lastNotified = today;
      changed = true;
    }
  });

  if (changed) saveMonthlyReminders(monthlyReminders);

  cloudMonthlyReminders.forEach(r => {
    const occursToday = occursOn(r, today);
    const alreadyDoneToday = isDoneOn(r, today);
    const alreadyNotifiedToday = r.lastNotified === today || cloudMonthlyNotifiedGuard.get(r.id) === today;

    if (occursToday && r.time === currentTime && !alreadyDoneToday && !alreadyNotifiedToday) {
      fireNotification(r, () => {
        mainWindow?.webContents.send('mark-cloud-monthly-done', { id: r.id, date: today });
      });

      cloudMonthlyNotifiedGuard.set(r.id, today);
      mainWindow?.webContents.send('mark-cloud-monthly-notified', r.id);
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  win.loadFile('index.html');
  mainWindow = win;
}

function sortByTime(reminders) {
  return [...reminders].sort((a, b) => a.time.localeCompare(b.time));
}

ipcMain.handle('get-reminders', () => {
  return sortByTime(loadReminders());
});

ipcMain.handle('add-reminder', (event, reminder) => {
  const reminders = loadReminders();
  reminders.push({ ...reminder, doneDate: null, lastNotified: null });
  saveReminders(reminders);
  return sortByTime(reminders);
});

ipcMain.handle('set-done', (event, { id, done }) => {
  const reminders = loadReminders();
  const today = todayStr();
  const target = reminders.find(r => r.id === id);
  if (target) {
    target.doneDate = done ? today : null;
  }
  saveReminders(reminders);
  return reminders;
});

ipcMain.handle('edit-reminder', (event, updated) => {
  const reminders = loadReminders();
  const target = reminders.find(r => r.id === updated.id);
  if (target) {
    target.name = updated.name;
    target.info = updated.info;
    target.time = updated.time;
    target.lastNotified = null;
  }
  saveReminders(reminders);
  return reminders;
});

ipcMain.handle('delete-reminder', (event, id) => {
  let reminders = loadReminders();
  reminders = reminders.filter(r => r.id !== id);
  saveReminders(reminders);
  return reminders;
});

ipcMain.on('cloud-reminders-updated', (event, reminders) => {
  cloudReminders = reminders || [];
});

ipcMain.handle('get-monthly-reminders', () => {
  return loadMonthlyReminders();
});

ipcMain.handle('add-monthly-reminder', (event, reminder) => {
  const reminders = loadMonthlyReminders();
  reminders.push({ ...reminder, completedDates: [], lastNotified: null });
  saveMonthlyReminders(reminders);
  return reminders;
});

ipcMain.handle('edit-monthly-reminder', (event, updated) => {
  const reminders = loadMonthlyReminders();
  const target = reminders.find(r => r.id === updated.id);
  if (target) {
    target.name = updated.name;
    target.info = updated.info;
    target.date = updated.date;
    target.time = updated.time;
    target.repeat = updated.repeat;
    target.lastNotified = null;
  }
  saveMonthlyReminders(reminders);
  return reminders;
});

ipcMain.handle('delete-monthly-reminder', (event, id) => {
  let reminders = loadMonthlyReminders();
  reminders = reminders.filter(r => r.id !== id);
  saveMonthlyReminders(reminders);
  return reminders;
});

ipcMain.handle('set-monthly-done', (event, { id, date, done }) => {
  const reminders = loadMonthlyReminders();
  const target = reminders.find(r => r.id === id);
  if (target) {
    if (!Array.isArray(target.completedDates)) target.completedDates = [];
    const idx = target.completedDates.indexOf(date);
    if (done && idx === -1) target.completedDates.push(date);
    if (!done && idx !== -1) target.completedDates.splice(idx, 1);
  }
  saveMonthlyReminders(reminders);
  return reminders;
});

ipcMain.on('cloud-monthly-reminders-updated', (event, reminders) => {
  cloudMonthlyReminders = reminders || [];
});

app.whenReady().then(() => {
  createWindow();
  setInterval(checkReminders, 1000);
});