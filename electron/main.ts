import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { initializeDatabase } from './db/initializeDatabase';
import { bootstrapStorage } from './runtime/bootstrapStorage';
import { reconcileDevLlmServerPath } from './runtime/llmServerPathReconciler';
import { registerIpcHandlers, shutdownSharedLlmRuntime } from './ipc/registerHandlers';

export function createMainApp() {
  let mainWindow: BrowserWindow | null = null;
  let handlersRegistered = false;

  const isDevMode = (): boolean => Boolean(process.env.VITE_DEV_SERVER_URL) || process.env.NODE_ENV === 'development';

  const createWindow = (): BrowserWindow => {
    const preloadPath = path.resolve(__dirname, 'preload.js');
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    });

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
      void window.loadURL(devServerUrl);
    } else {
      const rendererEntry = path.resolve(__dirname, '../renderer/dist/index.html');
      void window.loadFile(rendererEntry);
    }

    window.on('closed', () => {
      mainWindow = null;
    });
    mainWindow = window;
    return window;
  };

  const registerHandlers = (): readonly string[] => {
    if (handlersRegistered) {
      return [];
    }
    handlersRegistered = true;
    return registerIpcHandlers(ipcMain);
  };

  const start = async (): Promise<void> => {
    let isQuitting = false;

    if (isDevMode()) {
      app.setPath('userData', `${app.getPath('userData')}-dev`);
    }

    registerHandlers();

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', (event) => {
      if (isQuitting) {
        return;
      }
      isQuitting = true;
      event.preventDefault();
      void shutdownSharedLlmRuntime().finally(() => {
        app.quit();
      });
    });

    app.on('activate', () => {
      if (!mainWindow) {
        createWindow();
      }
    });

    await app.whenReady();
    await initializeDatabase();
    await bootstrapStorage();
    await reconcileDevLlmServerPath();
    if (!mainWindow) {
      createWindow();
    }
  };

  return {
    start,
    createWindow,
    registerHandlers
  };
}

if (!process.env.VITEST) {
  void createMainApp().start();
}
