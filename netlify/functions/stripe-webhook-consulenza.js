// netlify/functions/stripe-webhook-consulenza.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Solo POST
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
    // Verifica la signature di Stripe per sicurezza
    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_CONSULENZA;
    
    let stripeEvent;
    
    if (webhookSecret) {
      try {
        stripeEvent = stripe.webhooks.constructEvent(
          event.body,
          sig,
          webhookSecret
        );
      } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Webhook signature verification failed' })
        };
      }
    } else {
      // Se non hai configurato il webhook secret, usa il body direttamente
      stripeEvent = JSON.parse(event.body);
    }

    console.log('📥 Stripe event received:', stripeEvent.type);

    // Gestisci solo eventi di checkout completato
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      
      console.log('✅ Checkout completed for:', session.customer_email);

      // Recupera i dettagli del cliente e del pagamento
      const customer = await stripe.customers.retrieve(session.customer);
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
      
      // Prepara i dati per Make
      const webhookData = {
        // Dati cliente
        email: session.customer_email || customer.email,
        nome: session.customer_details?.name || customer.name || '',
        telefono: session.customer_details?.phone || customer.phone || '',
        
        // Dati pagamento
        importo: session.amount_total / 100, // Converti da centesimi a euro
        valuta: session.currency?.toUpperCase() || 'EUR',
        prodotto: 'consulenza_thomas_1h',
        descrizione: 'Consulenza privata 1h con Thomas Macorig',
        
        // Dati Stripe
        stripeSessionId: session.id,
        stripeCustomerId: session.customer,
        stripePaymentIntentId: session.payment_intent,
        
        // Timestamp
        dataAcquisto: new Date().toISOString(),
        dataAcquistoFormattata: new Date().toLocaleString('it-IT', {
          timeZone: 'Europe/Rome',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        
        // Tag per GoHighLevel o altri CRM
        tag: 'Consulenza_Thomas_500',
        
        // Info aggiuntive
        tipoAcquisto: 'stripe-checkout',
        nomeOfferta: 'Consulenza ONE TO ONE con Thomas - 1 ora',
        
        // Status
        paymentStatus: session.payment_status,
        status: session.status
      };

      console.log('📤 Sending data to Make webhook...');

      // Invia i dati al webhook di Make
      if (process.env.MAKE_WEBHOOK_CONSULENZA) {
        try {
          const makeResponse = await fetch(process.env.MAKE_WEBHOOK_CONSULENZA, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookData)
          });

          if (makeResponse.ok) {
            const makeResult = await makeResponse.text();
            console.log('✅ Data sent to Make successfully:', makeResult);
          } else {
            console.error('⚠️ Make webhook error:', await makeResponse.text());
          }
        } catch (makeError) {
          console.error('❌ Error sending to Make:', makeError);
          // Non bloccare il processo anche se Make fallisce
        }
      } else {
        console.warn('⚠️ MAKE_WEBHOOK_CONSULENZA not configured');
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          received: true,
          message: 'Webhook processed successfully'
        })
      };
    }

    // Altri tipi di eventi
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        received: true,
        message: 'Event type not handled'
      })
    };

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message 
      })
    };
  }
};