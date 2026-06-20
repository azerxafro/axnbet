-- Drop existing if any
DROP FUNCTION IF EXISTS public.process_wallet_transaction;

CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
    p_user_id UUID,
    p_amount NUMERIC,
    p_type TEXT,
    p_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_result JSONB;
BEGIN
    -- 1. Lock the profile row for this user to prevent concurrent modifications
    SELECT balance INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found for id %', p_user_id;
    END IF;

    -- 2. Check for sufficient funds if it's a deduction (p_amount < 0)
    IF p_amount < 0 AND v_current_balance + p_amount < 0 THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    -- 3. Calculate new balance
    v_new_balance := v_current_balance + p_amount;

    -- 4. Update the profile
    UPDATE public.profiles
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 5. Insert into ledger transactions
    INSERT INTO public.ledger_transactions (
        user_id,
        type,
        amount,
        status,
        reference_id
    ) VALUES (
        p_user_id,
        p_type,
        p_amount,
        'completed',
        p_reference
    );

    -- 6. Return success and the new balance
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Transaction completed successfully',
        'new_balance', v_new_balance
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Re-raise the exception to rollback the transaction
        RAISE;
END;
$$;
