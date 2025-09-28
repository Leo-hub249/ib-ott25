const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const {
      paymentMethodId,
      customerEmail,
      customerName,
      amount,
      currency,
      product,
      description,
      priceId
    } = JSON.parse(event.body);

    // Trova il cliente esistente (deve esistere dalla OTO1)
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    let customer = customers.data[0];
    
    if (!customer) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cliente non trovato' })
      };
    }

    // Crea payment intent con il metodo di pagamento salvato
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customer.id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: description,
      metadata: {
        product: product,
        priceId: priceId || '',
        customerEmail: customerEmail,
        customerName: customerName || ''
      }
    });

    if (paymentIntent.status === 'succeeded') {
      
      // INVIA I DATI AL WEBHOOK DI MAKE
      if (process.env.MAKE_WEBHOOK_OTO2) {
        try {
          const fetch = require('node-fetch');
          
          const webhookData = {
            // Dati cliente
            email: customerEmail,
            nome: customerName || customer.name || '',
            
            // Dati pagamento
            importo: amount / 100, // Converti in euro
            valuta: currency,
            prodotto: product,
            descrizione: description,
            
            // Dati Stripe
            stripeCustomerId: customer.id,
            stripePaymentIntentId: paymentIntent.id,
            stripePriceId: priceId || '',
            
            // Timestamp
            dataAcquisto: new Date().toISOString(),
            
            // Tag per GoHighLevel
            tag: 'OTO2_Consulenza_200',
            
            // Info aggiuntive
            tipoAcquisto: 'one-click',
            nomeOfferta: 'Consulenza Thomas 30 minuti'
          };

          console.log('Invio webhook a Make:', webhookData);

          const webhookResponse = await fetch(process.env.MAKE_WEBHOOK_OTO2, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookData)
          });

          if (webhookResponse.ok) {
            console.log('✅ Webhook inviato con successo a Make');
          } else {
            console.error('⚠️ Errore risposta webhook:', await webhookResponse.text());
          }

        } catch (webhookError) {
          console.error('❌ Errore invio webhook a Make:', webhookError);
          // NON bloccare il pagamento se il webhook fallisce
          // Il pagamento è già andato a buon fine
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          paymentIntentId: paymentIntent.id
        })
      };
      
    } else if (paymentIntent.status === 'requires_action') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          requiresAction: true,
          clientSecret: paymentIntent.client_secret
        })
      };
    } else {
      throw new Error('Stato pagamento non gestito: ' + paymentIntent.status);
    }

  } catch (error) {
    console.error('Errore one-click payment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};