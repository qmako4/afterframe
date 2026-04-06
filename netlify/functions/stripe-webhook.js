const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const subscription = stripeEvent.data.object;
  const customerEmail = subscription?.customer_email || 
    (await stripe.customers.retrieve(subscription.customer)).email;

  switch (stripeEvent.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      if (subscription.status === 'active') {
        await supabase
          .from('profiles')
          .update({ is_pro: true })
          .eq('email', customerEmail);
      }
      break;

    case 'customer.subscription.deleted':
    case 'invoice.payment_failed':
      await supabase
        .from('profiles')
        .update({ is_pro: false })
        .eq('email', customerEmail);
      break;
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
