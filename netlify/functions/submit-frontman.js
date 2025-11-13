// netlify/functions/submit-candidatura.js
// VERSIONE FIXATA - Problema risolto con Google Sheets che legge "1-3" come date

const { google } = require('googleapis');

// Google Sheets
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID_CANDIDATURE || process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const data = JSON.parse(event.body);
    
    // Valida i dati essenziali
    if (!data.nome_completo || !data.email || !data.telefono) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Nome, email e telefono sono obbligatori' })
      };
    }

    // Salva su Google Sheets
    await saveToGoogleSheets(data);
    console.log('✅ Candidatura salvata su Google Sheets');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Candidatura inviata con successo'
      })
    };

  } catch (error) {
    console.error('Errore:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Errore durante l\'invio della candidatura',
        details: error.message 
      })
    };
  }
};

// Funzione per salvare su Google Sheets
async function saveToGoogleSheets(data) {
  try {
    const auth = new google.auth.JWT(
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    // Formatta la data in orario italiano
    const now = new Date();
    const dataFormattata = now.toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Estrai numero senza prefisso internazionale
    let phoneWithoutPrefix = data.telefono;
    
    if (data.telefono.startsWith('+39')) {
      phoneWithoutPrefix = data.telefono.substring(3);
    } else if (data.telefono.startsWith('+1')) {
      phoneWithoutPrefix = data.telefono.substring(2);
    } else if (data.telefono.startsWith('+44')) {
      phoneWithoutPrefix = data.telefono.substring(3);
    } else if (data.telefono.startsWith('+49')) {
      phoneWithoutPrefix = data.telefono.substring(3);
    } else if (data.telefono.startsWith('+33')) {
      phoneWithoutPrefix = data.telefono.substring(3);
    } else if (data.telefono.startsWith('+34')) {
      phoneWithoutPrefix = data.telefono.substring(3);
    } else if (data.telefono.startsWith('+41')) {
      phoneWithoutPrefix = data.telefono.substring(3);
    } else if (data.telefono.startsWith('+')) {
      phoneWithoutPrefix = data.telefono.replace(/^\+\d{1,3}/, '');
    }

    // Prepara i dati per lo sheet - Colonne per candidature grafici
    // A: Nome | B: Email | C: Telefono Completo | D: Età | E: Data | F: Anni Esperienza 
    // G: Software | H: Portfolio | I: Disponibilità | J: Inizio | K: Messaggio | L: Tel senza prefisso
    const values = [[
      data.nome_completo,           // A
      data.email,                   // B
      data.telefono,                // C
      data.eta,                     // D
      dataFormattata,               // E
      `'${data.anni_esperienza}`,   // F - ✅ FIX: Apostrofo per forzare testo e evitare che "1-3" diventi data
      data.software,                // G
      data.portfolio,               // H
      data.disponibilita,           // I
      `'${data.inizio}`,            // J - ✅ FIX: Apostrofo per forzare testo
      data.messaggio,               // K
      phoneWithoutPrefix            // L
    ]];

    // Prima, ottieni l'ultima riga con dati per copiare la formattazione
    const rangeResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'Candidature!A:L', // Usa un foglio dedicato chiamato "Candidature"
    });

    const existingRows = rangeResponse.data.values || [];
    const lastRowNumber = existingRows.length;
    const nextRow = lastRowNumber + 1;

    // Inserisci i dati nella riga specifica (forza colonne A-L)
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `Candidature!A${nextRow}:L${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    // Copia la formattazione dalla riga precedente alla nuova riga
    if (lastRowNumber > 1) {
      const newRowNumber = lastRowNumber + 1;
      
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: GOOGLE_SHEET_ID,
          requestBody: {
            requests: [
              {
                copyPaste: {
                  source: {
                    sheetId: 0,  // Potrebbe essere necessario cambiare questo ID
                    startRowIndex: lastRowNumber - 1,
                    endRowIndex: lastRowNumber,
                    startColumnIndex: 0,
                    endColumnIndex: 12  // Colonne A-L (0-11)
                  },
                  destination: {
                    sheetId: 0,
                    startRowIndex: newRowNumber - 1,
                    endRowIndex: newRowNumber,
                    startColumnIndex: 0,
                    endColumnIndex: 12
                  },
                  pasteType: 'PASTE_FORMAT'
                }
              }
            ]
          }
        });
      } catch (formatError) {
        console.warn('⚠️ Impossibile copiare la formattazione, ma i dati sono stati salvati:', formatError.message);
      }
    }

  } catch (error) {
    console.error('Errore Google Sheets:', error);
    throw new Error('Impossibile salvare la candidatura su Google Sheets');
  }
}