-- Google AI: gemini-2.0-flash is no longer available to new API users; use 2.5 family.
update app_settings
set value = 'gemini-2.5-flash'
where key = 'ai_model'
  and value in ('gemini-2.0-flash', 'gemini-2.0-flash-thinking');

update app_settings
set value = 'gemini-2.5-pro'
where key = 'ai_model'
  and value = 'gemini-1.5-pro';
