-- Relabel Speed's age bands as explicit ranges instead of "U" prefixes, per
-- product decision. Boundaries are unchanged (U10=4-10, U13=11-13,
-- U15=14-15, U18=16-18, >18=19-25) — the shared boundary age (10/13/15/18)
-- stays owned by the lower band, same as before.

update public.five_s_age_bands set label = '<10' where category = 'speed' and label = 'U10';
update public.five_s_age_bands set label = '10-13' where category = 'speed' and label = 'U13';
update public.five_s_age_bands set label = '13-15' where category = 'speed' and label = 'U15';
update public.five_s_age_bands set label = '15-18' where category = 'speed' and label = 'U18';
