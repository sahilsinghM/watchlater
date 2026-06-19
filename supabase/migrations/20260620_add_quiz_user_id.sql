ALTER TABLE quiz_results ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
