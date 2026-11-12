-- Contraceptive pill packs on medications, and the perimenopause life stage.

alter table public.medications
  add column pack_type   text check (pack_type in ('combined_21_7', 'combined_21_7i', 'combined_24_4', 'continuous', 'pop')),
  add column pack_start  date,
  add column pack_set_on date,
  add constraint medications_pack_complete check ((pack_type is null) = (pack_start is null)),
  add constraint medications_pack_is_pill check (pack_type is null or kind = 'pill');

comment on column public.medications.pack_start is 'Day pill 1 of a pack was taken; later packs follow on from it.';

alter table public.cycle_settings
  add column life_stage text not null default 'cycles' check (life_stage in ('cycles', 'perimenopause'));

comment on column public.cycle_settings.life_stage is 'Perimenopause widens estimates and changes how irregular cycles are described.';
