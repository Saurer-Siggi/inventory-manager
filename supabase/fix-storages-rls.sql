-- Fix: storages could not be inserted/updated/deleted from the app because RLS only allowed SELECT.
-- Run this in Supabase → SQL Editor once (safe to re-run).

DROP POLICY IF EXISTS "Allow authenticated users to insert storages" ON storages;
DROP POLICY IF EXISTS "Allow authenticated users to update storages" ON storages;
DROP POLICY IF EXISTS "Allow authenticated users to delete storages" ON storages;

CREATE POLICY "Allow authenticated users to insert storages" ON storages
	FOR INSERT
	WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update storages" ON storages
	FOR UPDATE
	USING (auth.role() = 'authenticated')
	WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete storages" ON storages
	FOR DELETE
	USING (auth.role() = 'authenticated');
