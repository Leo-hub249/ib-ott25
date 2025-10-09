// netlify/functions/create-checkout-session.js

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
    const { priceId, successUrl, cancelUrl } = JSON.parse(event.body);

    // Crea una Checkout Session per EMBEDDED checkout
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded', // IMPORTANTE: Abilita l'embedding
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      return_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      metadata: {
        product: 'consulenza_thomas_1h',
        source: 'sales_page'
      },
      // Opzionale: pre-compila dati se disponibili
      // customer_email: 'email@example.com',
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        clientSecret: session.client_secret,
        sessionId: session.id
      })
    };

  } catch (error) {
    console.error('Errore creazione checkout session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};// netlify/functions/create-checkout-session.js

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
    const { priceId, successUrl, cancelUrl } = JSON.parse(event.body);

    // Crea una Checkout Session che PUÒ essere embedded in iframe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // IMPORTANTE: Non specificare customer_email qui per permettere l'embedding
      // L'utente inserirà l'email nel form di checkout
      metadata: {
        product: 'consulenza_thomas_1h',
        source: 'sales_page'
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sessionId: session.id,
        sessionUrl: session.url
      })
    };

  } catch (error) {
    console.error('Errore creazione checkout session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};