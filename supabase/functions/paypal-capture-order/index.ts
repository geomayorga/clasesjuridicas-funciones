// supabase/functions/paypal-capture-order/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Función para obtener el token de acceso de PayPal (reutilizada)
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
  // Manejo de CORS pre-flight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
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
    
    // Crear un cliente de Supabase para interactuar con la DB
    // Importante: Se usa el rol 'service_role' para poder escribir en la tabla de inscripciones
    // sin depender de las políticas de RLS del usuario, ya que esta función se ejecuta en el servidor.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener el ID del usuario desde el token de autenticación
    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (!user) {
        throw new Error('Usuario no autenticado.')
    }

    // Insertar la inscripción en la tabla 'enrollments'
    const { error: enrollmentError } = await supabaseAdmin.from('enrollments').insert({
        user_id: user.id,
        course_id: course_id,
        status: 'active', // o 'completado', 'iniciado', etc.
        progress: 0
    });

    if (enrollmentError) {
        // En un caso real, aquí deberías manejar la posibilidad de reembolsar el dinero
        // si la inscripción falla después de un pago exitoso.
        console.error("Error al inscribir al usuario:", enrollmentError);
        throw new Error('Pago completado, pero hubo un error al inscribirte en el curso. Contacta a soporte.');
    }

    return new Response(JSON.stringify({ success: true, message: '¡Pago completado e inscripción exitosa!' }), {
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