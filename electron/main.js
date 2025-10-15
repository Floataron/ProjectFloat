// ESM-friendly minimal Electron entry (package.json has "type":"module")
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = !app.isPackaged

let win

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 800,
        // Standard OS window; no special webPreferences needed beyond these:
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    if (isDev) {
        win.loadURL('http://localhost:5173')
    } else {
        // Load built index.html from Vite output
        win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
