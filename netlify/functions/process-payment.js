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
      amount, 
      currency, 
      customerEmail, 
      customerName,
      product 
    } = JSON.parse(event.body);

    // Crea o recupera il cliente
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });
    
    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName
      });
    }

    // Crea il payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customer.id,
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        product: product
      }
    });

    if (paymentIntent.status === 'succeeded') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
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
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};