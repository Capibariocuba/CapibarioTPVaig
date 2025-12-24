/**
 * Este archivo es el punto de entrada para ELECTRON (Windows/Linux/Mac).
 * Para usarlo:
 * 1. Instala electron: npm install electron --save-dev
 * 2. En package.json cambia "main" a "electron.js"
 * 3. Ejecuta: electron .
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "CubaPOS Pro",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'icon.png') // Necesitarías un icono
  });

  // En producción, cargar el archivo compilado
  // win.loadFile('dist/index.html');
  
  // En desarrollo, cargar la URL local
  win.loadURL('http://localhost:3000');
  
  // Quitar el menú superior predeterminado de Windows
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

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