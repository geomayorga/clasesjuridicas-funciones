// supabase/functions/contact-form-handler/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de la solicitud CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, subject, message } = await req.json()

    // 1. Guardar el mensaje en la base de datos
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: dbError } = await supabaseAdmin.from('contact_submissions').insert({
      name, email, subject, message
    });

    if (dbError) {
      throw new Error(`Error guardando en la base de datos: ${dbError.message}`);
    }

    // 2. Enviar la notificación por correo usando Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Notificaciones <noreply@clasesjuridicas.com>', // Debe ser un email de tu dominio verificado en Resend
        to: 'administrador@clasesjuridicas.com',
        subject: `Nuevo Mensaje de Contacto: ${subject}`,
        html: `
          <h1>Nuevo Mensaje Recibido</h1>
          <p>Has recibido un nuevo mensaje a través del formulario de contacto de tu web.</p>
          <hr>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Asunto:</strong> ${subject}</p>
          <p><strong>Mensaje:</strong></p>
          <p>${message}</p>
          <hr>
          <p>Puedes ver todos los mensajes en tu panel de Supabase.</p>
        `,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Error de Resend:", errorData);
        throw new Error('El mensaje se guardó, pero falló el envío de la notificación por email.');
    }

    return new Response(JSON.stringify({ success: true, message: 'Mensaje enviado y notificación enviada.' }), {
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