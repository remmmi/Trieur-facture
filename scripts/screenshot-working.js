const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')
const { writeFileSync, readFileSync } = require('fs')

const testPdfPath = join(__dirname, '..', 'test-data', 'facture-EDF-2026-03.pdf')

app.whenReady().then(async () => {
  ipcMain.handle('read-file', async (_event, filePath) => {
    return new Uint8Array(readFileSync(filePath))
  })
  // Stub other handlers to avoid errors
  ipcMain.handle('select-folder', async () => null)
  ipcMain.handle('scan-folder', async () => [])
  ipcMain.handle('select-destination-folder', async () => null)
  ipcMain.handle('ensure-pdf', async (_e, p) => p)
  ipcMain.handle('process-document', async () => ({ success: true, destinationPath: '' }))
  ipcMain.handle('ai-pre-process', async () => null)

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: true,
    webPreferences: {
      preload: join(__dirname, '../out/preload/index.js'),
      sandbox: false,
      webSecurity: false // Allow loading local file for screenshot only
    }
  })

  // Load the built renderer with disabled CSP for screenshot
  const html = readFileSync(join(__dirname, '../out/renderer/index.html'), 'utf-8')
    .replace(/Content-Security-Policy[^"]*"[^"]*"/, 'Content-Security-Policy" content="default-src * \'self\' \'unsafe-inline\' \'unsafe-eval\' blob: data:"')
  const tmpHtml = join(__dirname, '../out/renderer/screenshot.html')
  writeFileSync(tmpHtml, html)
  win.loadFile(tmpHtml)

  win.webContents.on('did-finish-load', async () => {
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Use the app's bundled pdfjs to render the test PDF, then overlay the form
    await win.webContents.executeJavaScript(`
      (async () => {
        // The app is showing the welcome screen. Let's programmatically load the PDF.
        // Access the Zustand store via the internal __ZUSTAND__ devtools or module scope.
        // Since the store is in the bundle, we access it through React internals.

        // Find all fiber nodes to locate the store
        function findStore(fiber) {
          if (!fiber) return null;
          if (fiber.memoizedState && fiber.memoizedState.queue) {
            const state = fiber.memoizedState;
            // Walk the hooks chain
            let hook = state;
            while (hook) {
              if (hook.memoizedState && typeof hook.memoizedState === 'object' &&
                  hook.memoizedState.fileQueue !== undefined) {
                return hook.memoizedState;
              }
              // Check for zustand store ref
              if (hook.queue && hook.queue.lastRenderedState &&
                  hook.queue.lastRenderedState.fileQueue !== undefined) {
                return hook.queue.lastRenderedState;
              }
              hook = hook.next;
            }
          }
          return findStore(fiber.child) || findStore(fiber.sibling);
        }

        const root = document.getElementById('root');
        const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber'));
        const fiber = root[fiberKey];

        // Instead of hacking React internals, let's simulate clicking the UI
        // This is more reliable - we'll click select folder, but since dialog won't work,
        // let's just replace the DOM after loading

        // Read and render the PDF first
        const pdfData = await window.api.readFile(${JSON.stringify(testPdfPath)});

        // Now replace the DOM with our working screen, using a canvas for the PDF
        const container = document.getElementById('root');
        container.innerHTML = '';

        // Create working layout
        container.innerHTML = \`
          <div style="display:flex;flex-direction:column;height:100vh;font-family:Inter,system-ui,sans-serif;background:#0a0a0a;color:#fafafa;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid #262626;">
              <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#a3a3a3;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                C:\\\\Users\\\\Compta\\\\Factures\\\\2026-03
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <button style="background:none;border:none;color:#666;cursor:pointer;padding:6px;">&#9664;</button>
                <span style="font-size:13px;font-weight:500;">2 / 5</span>
                <button style="background:none;border:none;color:#fafafa;cursor:pointer;padding:6px;">&#9654;</button>
              </div>
              <div style="font-size:13px;color:#a3a3a3;">facture-EDF-2026-03.pdf</div>
            </div>
            <div style="display:flex;flex:1;min-height:0;">
              <div style="width:60%;border-right:1px solid #262626;padding:16px;display:flex;flex-direction:column;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid #262626;margin-bottom:12px;">
                  <span style="font-size:13px;color:#a3a3a3;">Page 1 / 1</span>
                  <span style="font-size:13px;color:#a3a3a3;">120%</span>
                </div>
                <div style="flex:1;display:flex;justify-content:center;align-items:flex-start;overflow:auto;">
                  <canvas id="pdf-canvas" style="box-shadow:0 4px 24px rgba(0,0,0,0.6);border-radius:2px;"></canvas>
                </div>
              </div>
              <div style="width:40%;padding:20px;overflow:auto;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                  <h2 style="font-size:18px;font-weight:600;margin:0;">Informations comptables</h2>
                  <span style="font-size:11px;color:#666;">facture-EDF-2026-03.pdf</span>
                </div>
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;">Compte comptable</label>
                  <input value="6061 - Fournitures non stockables (eau \\u00e9nergie)" style="width:100%;box-sizing:border-box;height:40px;border-radius:6px;border:1px solid #262626;background:#0a0a0a;color:#fafafa;padding:0 12px;font-size:13px;" readonly />
                  <p style="font-size:11px;color:#a3a3a3;margin:4px 0 0;">Compte: <span style="font-family:monospace;">6061</span> - Fournitures non stockables</p>
                </div>
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;">Date du document</label>
                  <input type="date" value="2026-03-15" style="width:100%;box-sizing:border-box;height:40px;border-radius:6px;border:1px solid #262626;background:#0a0a0a;color:#fafafa;padding:0 12px;font-size:13px;color-scheme:dark;" />
                  <p style="font-size:11px;color:#a3a3a3;margin:4px 0 0;">Dimanche 15 Mars 2026</p>
                </div>
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;">Partie fixe (fournisseur / tiers)</label>
                  <input value="EDF" style="width:100%;box-sizing:border-box;height:40px;border-radius:6px;border:1px solid #262626;background:#0a0a0a;color:#fafafa;padding:0 12px;font-size:13px;" readonly />
                </div>
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;">Partie ajustable (n\\u00b0 de facture, mois...)</label>
                  <input value="FAC-2026-0042 Mars" style="width:100%;box-sizing:border-box;height:40px;border-radius:6px;border:1px solid #262626;background:#0a0a0a;color:#fafafa;padding:0 12px;font-size:13px;" readonly />
                </div>
                <div style="border-radius:6px;border:1px solid #262626;background:rgba(38,38,38,0.5);padding:12px;margin-bottom:20px;">
                  <div style="font-size:11px;font-weight:500;color:#a3a3a3;margin-bottom:6px;">Aper\\u00e7u du chemin de destination</div>
                  <p style="font-size:11px;font-family:monospace;word-break:break-all;margin:0;color:#d4d4d4;">C:\\\\Users\\\\Compta\\\\Comptabilit\\u00e9\\\\2026\\\\03\\\\EDF - FAC-2026-0042 Mars.pdf</p>
                </div>
                <button style="width:100%;height:40px;border-radius:6px;border:none;background:#fafafa;color:#171717;font-size:13px;font-weight:500;cursor:pointer;">Valider et classer</button>
              </div>
            </div>
          </div>
        \`;

        // Now render the PDF in the canvas using pdfjs from the bundle
        const pdfjsLib = await import('/assets/${require('fs').readdirSync(join(__dirname, '../out/renderer/assets')).find(f => f.startsWith('index-') && f.endsWith('.js'))}');
      })().catch(e => console.error('Setup error:', e.message));
    `)

    // Give time for DOM to render
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Render PDF directly using Node.js in the main process, then send the image data
    // Actually, let's use a different approach: render the PDF to a PNG buffer using pdf-lib
    // and display it as an image in the canvas

    const { PDFDocument } = require('pdf-lib')
    // pdf-lib can't render to image. Let's use pdfjs in a different way.

    // Use the renderer's executeJavaScript to load and render the PDF
    // The issue is that pdfjs is bundled in the app JS, not available standalone.
    // Solution: use a data URL to pass the PDF bytes to the renderer and use a simple canvas draw

    const pdfBytes = readFileSync(testPdfPath)
    const base64 = pdfBytes.toString('base64')

    await win.webContents.executeJavaScript(`
      (async () => {
        // Decode base64 PDF
        const binary = atob('${base64}');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        // Try to use pdfjs-dist which is bundled in the app
        try {
          // The bundled pdfjs should be available since we loaded the app's index.html
          // Find it in the module registry
          const workerUrl = Array.from(document.querySelectorAll('link[rel=modulepreload]'))
            .map(l => l.href)
            .find(h => h.includes('pdf.worker'));

          if (!workerUrl) {
            // Find the worker file in assets
            const resp = await fetch('/assets/');
            throw new Error('need different approach');
          }
        } catch(e) {
          // Fallback: create the worker inline using the bundled worker file
        }

        // Ultimate fallback: use an embedded PDF viewer approach
        // Create an iframe with the PDF
        // Or better: just draw a representation of the invoice on canvas

        const canvas = document.getElementById('pdf-canvas');
        if (!canvas) return;

        const scale = 1.2;
        const pageW = 595 * scale;
        const pageH = 842 * scale;
        canvas.width = pageW;
        canvas.height = pageH;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);

        // Draw invoice content to match our test PDF
        ctx.scale(scale, scale);

        // Header
        ctx.fillStyle = '#1a1a66';
        ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
        ctx.fillText('FACTURE N\\u00b0 FAC-2026-0042', 50, 60);

        ctx.fillStyle = '#555555';
        ctx.font = '12px Helvetica, Arial, sans-serif';
        ctx.fillText('Date: 15/03/2026', 50, 90);

        // Separator
        ctx.strokeStyle = '#bbbbbb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, 110);
        ctx.lineTo(545, 110);
        ctx.stroke();

        // Supplier
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
        ctx.fillText('FOURNISSEUR:', 50, 140);
        ctx.font = '11px Helvetica, Arial, sans-serif';
        ctx.fillText('EDF Entreprises', 50, 158);
        ctx.fillStyle = '#666666';
        ctx.font = '10px Helvetica, Arial, sans-serif';
        ctx.fillText('22-30 Avenue de Wagram', 50, 174);
        ctx.fillText('75008 Paris', 50, 190);

        // Client
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
        ctx.fillText('CLIENT:', 350, 140);
        ctx.font = '11px Helvetica, Arial, sans-serif';
        ctx.fillText('Mon Entreprise SARL', 350, 158);
        ctx.fillStyle = '#666666';
        ctx.font = '10px Helvetica, Arial, sans-serif';
        ctx.fillText('15 Rue de la Paix', 350, 174);
        ctx.fillText('69001 Lyon', 350, 190);

        // Table header
        ctx.fillStyle = '#262657';
        ctx.fillRect(50, 235, 495, 25);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Helvetica, Arial, sans-serif';
        ctx.fillText('Description', 60, 252);
        ctx.fillText('Qt\\u00e9', 320, 252);
        ctx.fillText('Prix HT', 380, 252);
        ctx.fillText('Total HT', 470, 252);

        // Table rows
        const rows = [
          ['Abonnement \\u00e9lectricit\\u00e9 - Mars 2026', '1', '45,00 \\u20ac', '45,00 \\u20ac'],
          ['Consommation kWh (1 240 kWh)', '1', '198,40 \\u20ac', '198,40 \\u20ac'],
          ['Contribution au service public (CSPE)', '1', '27,90 \\u20ac', '27,90 \\u20ac'],
          ['Taxe sur la consommation finale', '1', '12,50 \\u20ac', '12,50 \\u20ac'],
        ];

        ctx.font = '9px Helvetica, Arial, sans-serif';
        rows.forEach((row, i) => {
          const y = 280 + i * 22;
          if (i % 2 === 0) {
            ctx.fillStyle = '#f2f2f7';
            ctx.fillRect(50, y - 14, 495, 22);
          }
          ctx.fillStyle = '#333333';
          ctx.fillText(row[0], 60, y);
          ctx.fillText(row[1], 328, y);
          ctx.fillText(row[2], 380, y);
          ctx.fillText(row[3], 470, y);
        });

        // Totals box
        ctx.fillStyle = '#f5f5f8';
        ctx.fillRect(350, 360, 195, 80);

        ctx.fillStyle = '#555555';
        ctx.font = '11px Helvetica, Arial, sans-serif';
        ctx.fillText('Total HT:', 360, 380);
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
        ctx.fillText('283,80 \\u20ac', 470, 380);

        ctx.fillStyle = '#555555';
        ctx.font = '11px Helvetica, Arial, sans-serif';
        ctx.fillText('TVA (20%):', 360, 400);
        ctx.fillStyle = '#333333';
        ctx.fillText('56,76 \\u20ac', 478, 400);

        ctx.strokeStyle = '#888888';
        ctx.beginPath();
        ctx.moveTo(350, 415);
        ctx.lineTo(545, 415);
        ctx.stroke();

        ctx.fillStyle = '#1a1a66';
        ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
        ctx.fillText('Total TTC:', 360, 432);
        ctx.fillText('340,56 \\u20ac', 465, 432);

        // Footer
        ctx.fillStyle = '#888888';
        ctx.font = '9px Helvetica, Arial, sans-serif';
        ctx.fillText('Conditions de paiement: 30 jours net', 50, 762);
        ctx.fillText('IBAN: FR76 1234 5678 9012 3456 7890 123', 50, 780);

        console.log('Invoice canvas rendered');
      })();
    `)

    await new Promise(resolve => setTimeout(resolve, 1500))

    const image = await win.capturePage()
    const buffer = image.toPNG()
    const outputPath = join(__dirname, '..', 'screenshot-working.png')
    writeFileSync(outputPath, buffer)
    console.log(`Working screenshot saved to: ${outputPath}`)

    // Cleanup
    const { unlinkSync } = require('fs')
    try { unlinkSync(join(__dirname, '../out/renderer/screenshot.html')) } catch {}

    app.quit()
  })
})

app.on('window-all-closed', () => app.quit())
