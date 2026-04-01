const { app, BrowserWindow } = require('electron')
const { join } = require('path')
const { writeFileSync } = require('fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: true,
    webPreferences: {
      preload: join(__dirname, '../out/preload/index.js'),
      sandbox: false
    }
  })

  // Load the built renderer
  win.loadFile(join(__dirname, '../out/renderer/index.html'))

  // Wait for the page to fully render
  win.webContents.on('did-finish-load', async () => {
    // Give React a moment to mount
    await new Promise(resolve => setTimeout(resolve, 2000))

    const image = await win.capturePage()
    const buffer = image.toPNG()
    const outputPath = join(__dirname, '..', 'screenshot.png')
    writeFileSync(outputPath, buffer)
    console.log(`Screenshot saved to: ${outputPath}`)

    app.quit()
  })
})

app.on('window-all-closed', () => app.quit())
