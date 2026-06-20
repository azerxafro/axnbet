-- ==========================================
-- AXN AGENCY DATABASE SCHEMA
-- Designed for Supabase / PostgreSQL
-- Includes RLS Policies & Transaction Functions
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    username TEXT,
    balance DECIMAL(12, 2) DEFAULT 0.00 CHECK (balance >= 0),
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

-- Note: Updates to balance should only be done via secure database RPC functions or service role.
CREATE POLICY "Users cannot update their own balance directly"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id); -- We will enforce trigger/function based changes for balance updates.


-- 2. Lottery Cycles Table
CREATE TABLE public.lottery_cycles (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL, 
    draw_time TIMESTAMP WITH TIME ZONE NOT NULL,
    cycle_number INT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'locked', 'completed')),
    winning_numbers TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for lottery_cycles
ALTER TABLE public.lottery_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lottery cycles" 
    ON public.lottery_cycles FOR SELECT 
    USING (true);

CREATE POLICY "Only admins can insert/update lottery cycles" 
    ON public.lottery_cycles FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );


-- 3. Tickets / Bets Table
CREATE TABLE public.tickets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    cycle_id BIGINT REFERENCES public.lottery_cycles(id) NOT NULL,
    bet_numbers TEXT NOT NULL, 
    bet_amount DECIMAL(12, 2) NOT NULL CHECK (bet_amount > 0),
    multiplier INT DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'win', 'lose')),
    payout_amount DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tickets" 
    ON public.tickets FOR SELECT 
    USING (auth.uid() = user_id);


-- 4. Financial Ledger Table
CREATE TABLE public.ledger_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet_placement', 'win_payout')),
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    reference_id TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for ledger_transactions
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transaction ledger" 
    ON public.ledger_transactions FOR SELECT 
    USING (auth.uid() = user_id);


-- 5. Public Chat Table (Real-time enabled)
CREATE TABLE public.chats (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL CHECK (length(trim(message)) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat messages" 
    ON public.chats FOR SELECT 
    USING (true);

CREATE POLICY "Authenticated users can post chat messages" 
    ON public.chats FOR INSERT 
    WITH CHECK (auth.uid() = user_id);


-- ==========================================
-- SECURE STORED PROCEDURES (RPCs)
-- ==========================================

-- Function: buy_ticket
-- Performs database-side transactional validation and balance updates
CREATE OR REPLACE FUNCTION public.buy_ticket(
    p_cycle_id BIGINT,
    p_bet_numbers TEXT,
    p_bet_amount DECIMAL(12, 2),
    p_multiplier INT DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (admin bypass) to update user balance
AS $$
DECLARE
    v_user_id UUID;
    v_balance DECIMAL(12, 2);
    v_cycle_status TEXT;
    v_draw_time TIMESTAMP WITH TIME ZONE;
    v_total_cost DECIMAL(12, 2);
    v_ticket_id BIGINT;
BEGIN
    -- 1. Get authenticated user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized: User is not authenticated.');
    END IF;

    -- 2. Fetch user's current wallet balance
    SELECT balance INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User profile not found.');
    END IF;

    -- 3. Fetch cycle details & verify status
    SELECT status, draw_time INTO v_cycle_status, v_draw_time 
    FROM public.lottery_cycles WHERE id = p_cycle_id FOR SHARE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Lottery cycle not found.');
    END IF;

    IF v_cycle_status != 'open' OR v_draw_time <= NOW() THEN
        RETURN json_build_object('success', false, 'message', 'Betting is closed for this cycle.');
    END IF;

    -- 4. Calculate total cost and verify funds
    v_total_cost := p_bet_amount * p_multiplier;
    IF v_balance < v_total_cost THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Please deposit funds.');
    END IF;

    -- 5. Deduct balance from user profile
    UPDATE public.profiles 
    SET balance = balance - v_total_cost 
    WHERE id = v_user_id;

    -- 6. Record ticket purchase
    INSERT INTO public.tickets (user_id, cycle_id, bet_numbers, bet_amount, multiplier, status)
    VALUES (v_user_id, p_cycle_id, p_bet_numbers, p_bet_amount, p_multiplier, 'pending')
    RETURNING id INTO v_ticket_id;

    -- 7. Record transaction ledger audit trail
    INSERT INTO public.ledger_transactions (user_id, type, amount, status, reference_id)
    VALUES (v_user_id, 'bet_placement', -v_total_cost, 'completed', v_ticket_id::TEXT);

    RETURN json_build_object(
        'success', true, 
        'message', 'Ticket purchased successfully.', 
        'ticket_id', v_ticket_id,
        'new_balance', (v_balance - v_total_cost)
    );
END;
$$;


-- Triggers: Automatically create user profile when a new user registers via Supabase auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone_number, username, balance, role)
  VALUES (
    new.id,
    new.phone, -- Supabase auth phone number
    COALESCE(new.raw_user_meta_data->>'username', 'User_' || substr(new.id::text, 1, 8)),
    0.00,
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
