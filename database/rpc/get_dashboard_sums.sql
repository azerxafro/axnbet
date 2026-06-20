-- Drop existing if any
DROP FUNCTION IF EXISTS public.get_dashboard_sums;

CREATE OR REPLACE FUNCTION public.get_dashboard_sums()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_balance NUMERIC;
    v_total_bets NUMERIC;
BEGIN
    -- Fast aggregation directly in the database
    SELECT COALESCE(SUM(balance), 0) INTO v_total_balance FROM public.profiles;
    SELECT COALESCE(SUM(bet_amount), 0) INTO v_total_bets FROM public.tickets;

    RETURN jsonb_build_object(
        'totalBalance', v_total_balance,
        'totalBetsAmount', v_total_bets
    );
END;
$$;
