const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

const dataPath = path.join(app.getPath('userData'), 'reminders.json');

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

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

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
      const notification = new Notification({
        title: r.name,
        body: r.info || 'Reminder!',
        timeoutType: 'never'
      });

      notification.on('click', () => {
        const reminders = loadReminders();
        const target = reminders.find(x => x.id === r.id);
        if (target) {
          target.doneDate = today;
          saveReminders(reminders);
        }
      });

      notification.show();

      r.lastNotified = today;
      changed = true;
    }
  });

  if (changed) saveReminders(reminders);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
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
    // Note: if the time changes, you may want to reset lastNotified
    // so it can notify again today at the new time:
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

app.whenReady().then(() => {
  createWindow();
  setInterval(checkReminders, 1000); // check every 15 seconds now
});