// netlify/functions/submit-frontman.js
// VERSIONE DEBUG - Con logging dettagliato

const { google } = require('googleapis');

// Google Sheets
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID_FRONTMAN || process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

exports.handler = async (event, context) => {
  console.log('🚀 Function started');
  console.log('📝 HTTP Method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    console.log('❌ Method not allowed');
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
    console.log('📦 Parsing request body...');
    const data = JSON.parse(event.body);
    console.log('✅ Data received:', JSON.stringify(data, null, 2));
    
    // Valida i dati essenziali
    if (!data.nome_completo || !data.email || !data.telefono) {
      console.log('❌ Missing required fields');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Nome, email e telefono sono obbligatori' })
      };
    }

    console.log('🔑 Checking environment variables...');
    console.log('- GOOGLE_SHEET_ID:', GOOGLE_SHEET_ID ? '✅ Present' : '❌ Missing');
    console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Present' : '❌ Missing');
    console.log('- GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? '✅ Present' : '❌ Missing');

    if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      console.log('❌ Missing environment variables!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Missing Google Sheets configuration',
          details: 'Check Netlify environment variables'
        })
      };
    }

    // Salva su Google Sheets
    console.log('📊 Attempting to save to Google Sheets...');
    await saveToGoogleSheets(data);
    console.log('✅ Successfully saved to Google Sheets');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Candidatura inviata con successo'
      })
    };

  } catch (error) {
    console.error('💥 ERROR:', error);
    console.error('Stack trace:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Errore durante l\'invio della candidatura',
        details: error.message,
        stack: error.stack
      })
    };
  }
};

// Funzione per salvare su Google Sheets
async function saveToGoogleSheets(data) {
  try {
    console.log('🔐 Creating Google Auth...');
    const auth = new google.auth.JWT(
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    console.log('📊 Initializing Google Sheets API...');
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
    console.log('📅 Formatted date:', dataFormattata);
    
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
    console.log('📱 Phone without prefix:', phoneWithoutPrefix);

    // Prepara i dati per lo sheet
    const values = [[
      data.nome_completo,           // A
      data.email,                   // B
      data.telefono,                // C
      data.eta,                     // D
      dataFormattata,               // E
      data.esperienza_business,     // F
      `'${data.anni_esperienza}`,   // G
      data.parla_telecamera,        // H
      data.piattaforme,             // I
      data.link_contenuti || 'Non fornito',  // J
      data.link_social || 'Non fornito',     // K
      data.disponibilita,           // L
      `'${data.inizio}`,            // M
      data.messaggio || 'Nessun messaggio',  // N
      phoneWithoutPrefix            // O
    ]];

    console.log('📝 Data to write:', JSON.stringify(values, null, 2));
    console.log('🎯 Sheet ID:', GOOGLE_SHEET_ID);
    console.log('📍 Target sheet: Frontman');

    // Prima, ottieni l'ultima riga
    console.log('🔍 Getting existing rows...');
    const rangeResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'Frontman!A:O',
    });

    const existingRows = rangeResponse.data.values || [];
    const lastRowNumber = existingRows.length;
    const nextRow = lastRowNumber + 1;
    
    console.log('📊 Last row number:', lastRowNumber);
    console.log('📌 Next row:', nextRow);
    console.log('🎯 Writing to range:', `Frontman!A${nextRow}:O${nextRow}`);

    // Inserisci i dati nella riga specifica
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `Frontman!A${nextRow}:O${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    console.log('✅ Update response:', JSON.stringify(updateResponse.data, null, 2));

    // Copia la formattazione dalla riga precedente
    if (lastRowNumber > 1) {
      console.log('🎨 Copying formatting from previous row...');
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: GOOGLE_SHEET_ID,
          requestBody: {
            requests: [
              {
                copyPaste: {
                  source: {
                    sheetId: 0,
                    startRowIndex: lastRowNumber - 1,
                    endRowIndex: lastRowNumber,
                    startColumnIndex: 0,
                    endColumnIndex: 15
                  },
                  destination: {
                    sheetId: 0,
                    startRowIndex: nextRow - 1,
                    endRowIndex: nextRow,
                    startColumnIndex: 0,
                    endColumnIndex: 15
                  },
                  pasteType: 'PASTE_FORMAT'
                }
              }
            ]
          }
        });
        console.log('✅ Formatting copied successfully');
      } catch (formatError) {
        console.warn('⚠️ Could not copy formatting:', formatError.message);
      }
    }

    console.log('🎉 All done!');

  } catch (error) {
    console.error('💥 Error in saveToGoogleSheets:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors
    });
    throw new Error('Impossibile salvare la candidatura su Google Sheets: ' + error.message);
  }
}