// supabase/functions/paypal-create-order/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Headers de CORS para permitir las solicitudes desde tu web
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // O puedes poner 'https://clasesjuridicas.com' para más seguridad
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getPayPalAccessToken() {
  // ... (código existente sin cambios) ...
}

serve(async (req) => {
  // Manejo de la solicitud "pre-flight" de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { coursePrice } = await req.json()
    // ... (resto del código para crear la orden) ...

    return new Response(JSON.stringify({ id: orderData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})