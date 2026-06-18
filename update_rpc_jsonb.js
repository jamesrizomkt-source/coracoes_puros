const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  await client.query(`
    CREATE OR REPLACE FUNCTION public.calculate_melhor_envio(p_to_postal_code text)
     RETURNS jsonb
     LANGUAGE plpgsql
     SECURITY DEFINER
    AS $function$
    DECLARE
      v_token text;
      v_from_cep text;
      v_is_sandbox text;
      v_insurance_enabled text;
      v_ar_enabled text;
      v_book_price numeric;
      v_book_weight numeric;
      v_book_width numeric;
      v_book_height numeric;
      v_book_length numeric;
      v_insurance_value numeric;
      v_api_url text;
      v_request_body jsonb;
      v_http_response http_response;
      v_services jsonb;
    BEGIN
      SELECT value #>> '{}' INTO v_token FROM public.settings WHERE key = 'melhor_envio_token';
      SELECT value #>> '{}' INTO v_from_cep FROM public.settings WHERE key = 'melhor_envio_origin_cep';
      SELECT value #>> '{}' INTO v_is_sandbox FROM public.settings WHERE key = 'melhor_envio_sandbox';
      SELECT value #>> '{}' INTO v_insurance_enabled FROM public.settings WHERE key = 'melhor_envio_insurance_enabled';
      SELECT value #>> '{}' INTO v_ar_enabled FROM public.settings WHERE key = 'melhor_envio_ar_enabled';
      
      v_from_cep := COALESCE(REGEXP_REPLACE(v_from_cep, '\\D', '', 'g'), '');
      v_book_price := 49.90;
      v_book_weight := 0.300;
      v_book_width := 15;
      v_book_height := 2;
      v_book_length := 22;

      IF v_token IS NULL OR v_token = '' OR v_from_cep = '' THEN
        RETURN jsonb_build_object('error', 'Melhor Envio token or origin CEP is missing in settings');
      END IF;

      IF v_is_sandbox = 'true' THEN
        v_api_url := 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate';
      ELSE
        v_api_url := 'https://www.melhorenvio.com.br/api/v2/me/shipment/calculate';
      END IF;

      IF v_insurance_enabled = 'true' THEN
        v_insurance_value := v_book_price;
      ELSE
        v_insurance_value := 0;
      END IF;

      v_request_body := jsonb_build_object(
        'from', jsonb_build_object('postal_code', v_from_cep),
        'to', jsonb_build_object('postal_code', REGEXP_REPLACE(p_to_postal_code, '\\D', '', 'g')),
        'products', jsonb_build_array(
          jsonb_build_object(
            'id', 'coracoes-puros-livro',
            'width', v_book_width,
            'height', v_book_height,
            'length', v_book_length,
            'weight', v_book_weight,
            'insurance_value', v_insurance_value,
            'quantity', 1
          )
        ),
        'options', jsonb_build_object(
          'receipt', CASE WHEN v_ar_enabled = 'true' THEN true ELSE false END,
          'own_hand', false,
          'collect', false,
          'insurance_value', v_insurance_value
        )
      );

      SELECT * INTO v_http_response FROM http((
        'POST',
        v_api_url,
        ARRAY[
          http_header('Authorization', 'Bearer ' || v_token),
          http_header('Accept', 'application/json'),
          http_header('Content-Type', 'application/json'),
          http_header('User-Agent', 'CoracoesPuros (contato@coracoespuros.com.br)')
        ],
        'application/json',
        v_request_body::text
      )::http_request);

      IF v_http_response.status >= 400 THEN
        RETURN jsonb_build_object('error', 'Erro na API do Melhor Envio', 'details', v_http_response.content);
      END IF;

      v_services := v_http_response.content::jsonb;
      
      IF jsonb_typeof(v_services) != 'array' THEN
        RETURN jsonb_build_object('error', 'Resposta inesperada do Melhor Envio', 'details', v_services);
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'servicos', (
           SELECT jsonb_agg(s)
           FROM jsonb_array_elements(v_services) s
           WHERE NOT (s ? 'error') OR (s->>'error' IS NULL) OR (s->>'error' = '')
        )
      );
    END;
    $function$
  `);
  console.log("Updated RPC function with JSONB unquoting!");
  
  // Test it directly after updating
  const testRes = await client.query(`SELECT calculate_melhor_envio('31910-040')`);
  console.log("RPC Test Result:", testRes.rows[0]);

  await client.end();
}
run().catch(console.error);
