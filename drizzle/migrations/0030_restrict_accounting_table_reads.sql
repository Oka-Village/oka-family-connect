DROP POLICY IF EXISTS company_expenses_select_authenticated ON public.company_expenses;
CREATE POLICY company_expenses_select_staff ON public.company_expenses FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS company_equity_cap_table_select_authenticated ON public.company_equity_cap_table;
CREATE POLICY company_equity_cap_table_select_staff ON public.company_equity_cap_table FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS company_financial_snapshots_select_authenticated ON public.company_financial_snapshots;
CREATE POLICY company_financial_snapshots_select_staff ON public.company_financial_snapshots FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS event_contributions_select_authenticated ON public.event_contributions;
CREATE POLICY event_contributions_select_host_or_staff ON public.event_contributions FOR SELECT TO authenticated USING (host_id = auth.uid() OR public.is_staff(auth.uid()));