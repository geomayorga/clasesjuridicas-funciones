import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Headers de CORS para permitir las solicitudes desde tu web
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // O 'https://clasesjuridicas.com' para más seguridad
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  // Manejo esencial de la solicitud "pre-flight" de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderID, course_id } = await req.json()

    // 1. Capturar el pago en PayPal
    const accessToken = await getPayPalAccessToken()
    const captureResponse = await fetch(`${Deno.env.get('PAYPAL_API_URL')}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    const captureData = await captureResponse.json()

    if (captureData.status !== 'COMPLETED') {
      throw new Error('El pago no pudo ser completado por PayPal.');
    }
    
    // 2. Si el pago fue exitoso, inscribir al usuario en el curso
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (!user) {
        throw new Error('Usuario no autenticado.')
    }

    const { error: enrollmentError } = await supabaseAdmin.from('enrollments').insert({
        user_id: user.id,
        course_id: course_id,
        status: 'active',
        progress: 0
    });

    if (enrollmentError) {
        console.error("Error al inscribir al usuario:", enrollmentError);
        throw new Error('Pago completado, pero hubo un error al inscribirte en el curso. Contacta a soporte.');
    }

    return new Response(JSON.stringify({ success: true, message: '¡Pago completado e inscripción exitosa!' }), {
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