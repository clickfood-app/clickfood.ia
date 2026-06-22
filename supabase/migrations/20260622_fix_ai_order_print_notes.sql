CREATE OR REPLACE FUNCTION public.create_order_print_job_for_order(
  p_order_id uuid,
  p_force_reprint boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_restaurant_name text;
  v_restaurant_logo_url text;
  v_items jsonb;
  v_payload jsonb;
  v_existing_job_id uuid;
  v_existing_status text;
  v_job_id uuid;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  limit 1;

  if v_order.id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'ORDER_NOT_FOUND'
    );
  end if;

  select
    r.name,
    r.logo_url
  into
    v_restaurant_name,
    v_restaurant_logo_url
  from public.restaurants r
  where r.id = v_order.restaurant_id
  limit 1;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', oi.product_name,
          'quantity', oi.quantity,
          'price', oi.unit_price,
          'notes',
            nullif(
              concat_ws(
                ' | ',
                nullif(oi.notes, ''),
                case
                  when oi.modifiers is not null
                    and oi.modifiers <> '[]'::jsonb
                    and oi.modifiers <> '{}'::jsonb
                    then 'Complementos: ' || oi.modifiers::text
                  else null
                end
              ),
              ''
            )
        )
        order by oi.product_name
      ),
      '[]'::jsonb
    )
  into v_items
  from public.order_items oi
  where oi.order_id = p_order_id;

  v_payload := jsonb_build_object(
    'restaurantName', coalesce(v_restaurant_name, 'Restaurante'),
    'restaurantLogoUrl', v_restaurant_logo_url,
    'orderNumber', v_order.public_order_number,
    'customerName', v_order.customer_name,
    'customerPhone', v_order.customer_phone,
    'orderType',
      case
        when v_order.order_type = 'delivery' then 'Entrega'
        when v_order.order_type = 'pickup' then 'Retirada'
        when v_order.order_type = 'table' then coalesce('Mesa ' || nullif(v_order.table_number, ''), 'Mesa')
        when v_order.table_number is not null then 'Mesa ' || v_order.table_number
        else coalesce(v_order.order_type, 'Pedido')
      end,
    'paymentMethod', coalesce(v_order.payment_method, 'Não informado'),
    'subtotal', v_order.subtotal,
    'discount', v_order.discount,
    'deliveryFee', v_order.delivery_fee,
    'serviceFee', v_order.service_fee,
    'total', v_order.total,
    'address', coalesce(v_order.delivery_address, v_order.customer_address),
    'neighborhood', coalesce(v_order.delivery_neighborhood, v_order.customer_neighborhood),
    'tableNumber', v_order.table_number,
    'guestCount', v_order.guest_count,
    'notes',
      case
        when lower(coalesce(v_order.order_source, '')) = 'whatsapp_ai'
          or lower(coalesce(v_order.notes, '')) like '%ai draft%'
          or lower(coalesce(v_order.notes, '')) like '%pedido criado pela ia%'
          or lower(coalesce(v_order.notes, '')) like '%pedido criado por ia%'
          or lower(coalesce(v_order.notes, '')) like '%pedido criado pela ia do whatsapp%'
          then 'Pedido criado por IA'
        else nullif(trim(v_order.notes), '')
      end,
    'needsChange', v_order.needs_change,
    'changeFor', v_order.change_for,
    'items', v_items
  );

  select id, status
  into v_existing_job_id, v_existing_status
  from public.order_print_jobs
  where order_id = p_order_id
    and job_type = 'customer_receipt'
  limit 1;

  if v_existing_job_id is not null
    and v_existing_status in ('printing', 'printed')
    and p_force_reprint = false
  then
    return jsonb_build_object(
      'success', true,
      'jobId', v_existing_job_id,
      'status', v_existing_status,
      'alreadyExists', true
    );
  end if;

  insert into public.order_print_jobs (
    restaurant_id,
    order_id,
    job_type,
    status,
    payload,
    device_id,
    locked_by_device_id,
    locked_at,
    printed_at,
    error_message
  )
  values (
    v_order.restaurant_id,
    v_order.id,
    'customer_receipt',
    'pending',
    v_payload,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (order_id, job_type)
  do update set
    restaurant_id = excluded.restaurant_id,
    status = 'pending',
    payload = excluded.payload,
    device_id = null,
    locked_by_device_id = null,
    locked_at = null,
    printed_at = null,
    error_message = null,
    updated_at = now()
  returning id into v_job_id;

  return jsonb_build_object(
    'success', true,
    'jobId', v_job_id,
    'status', 'pending',
    'alreadyExists', false
  );
end;
$function$;
