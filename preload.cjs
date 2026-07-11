const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getReminders: () => ipcRenderer.invoke('get-reminders'),
  addReminder: (reminder) => ipcRenderer.invoke('add-reminder', reminder),
  setDone: (id, done) => ipcRenderer.invoke('set-done', { id, done }),
  deleteReminder: (id) => ipcRenderer.invoke('delete-reminder', id),
  editReminder: (updated) => ipcRenderer.invoke('edit-reminder', updated)
});