const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getReminders: () => ipcRenderer.invoke('get-reminders'),
  addReminder: (reminder) => ipcRenderer.invoke('add-reminder', reminder),
  setDone: (id, done) => ipcRenderer.invoke('set-done', { id, done }),
  deleteReminder: (id) => ipcRenderer.invoke('delete-reminder', id),
  editReminder: (updated) => ipcRenderer.invoke('edit-reminder', updated),
  syncCloudReminders: (reminders) => ipcRenderer.send('cloud-reminders-updated', reminders),
  onMarkCloudNotified: (callback) => ipcRenderer.on('mark-cloud-notified', (event, id) => callback(id)),
  onMarkCloudDone: (callback) => ipcRenderer.on('mark-cloud-done', (event, id) => callback(id)),

  getMonthlyReminders: () => ipcRenderer.invoke('get-monthly-reminders'),
  addMonthlyReminder: (reminder) => ipcRenderer.invoke('add-monthly-reminder', reminder),
  editMonthlyReminder: (updated) => ipcRenderer.invoke('edit-monthly-reminder', updated),
  deleteMonthlyReminder: (id) => ipcRenderer.invoke('delete-monthly-reminder', id),
  setMonthlyDone: (id, date, done) => ipcRenderer.invoke('set-monthly-done', { id, date, done }),
  syncCloudMonthlyReminders: (reminders) => ipcRenderer.send('cloud-monthly-reminders-updated', reminders),
  onMarkCloudMonthlyNotified: (callback) => ipcRenderer.on('mark-cloud-monthly-notified', (event, id) => callback(id)),
  onMarkCloudMonthlyDone: (callback) => ipcRenderer.on('mark-cloud-monthly-done', (event, payload) => callback(payload))
});