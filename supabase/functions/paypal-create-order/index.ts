import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Función para obtener el token de acceso de PayPal
async function getPayPalAccessToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
  const auth = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch(`${Deno.env.get('PAYPAL_API_URL')}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  
  const data = await response.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { coursePrice } = await req.json()
    const accessToken = await getPayPalAccessToken()
    
    const orderResponse = await fetch(`${Deno.env.get('PAYPAL_API_URL')}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD', // Cambia a tu moneda
            value: coursePrice.toString(),
          },
        }],
      }),
    })
    
    const orderData = await orderResponse.json()
    
    return new Response(JSON.stringify({ id: orderData.id }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500,
    })
  }
})