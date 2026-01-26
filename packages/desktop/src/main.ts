import { app, BrowserWindow, globalShortcut } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true,
        title: 'Memory Hub'
    });

    // In DEV mode, load the Vite dev server
    // In PROD, we would load the index.html from dist
    mainWindow.loadURL('http://localhost:5173');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    // Register a 'CommandOrControl+Shift+M' shortcut listener.
    const ret = globalShortcut.register('CommandOrControl+Shift+M', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });

    if (!ret) {
        console.log('registration failed');
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
