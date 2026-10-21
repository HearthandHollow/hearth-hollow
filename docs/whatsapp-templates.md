# WhatsApp message templates — starter set (DRAFT, not submitted)

Submit in **WhatsApp Manager → Message templates → Create**. All are **Utility** (transactional, cheapest,
fastest review). Language **English (US)**. Keep variables exactly as numbered. The business-manager
Claude can polish the copy; Meta rejects templates that read as marketing inside the Utility category.

| Name | Used by | Body | Example variables |
|---|---|---|---|
| `rt_tournament_reminder` | RackerTracker | Reminder: {{1}} starts {{2}} at {{3}}. Check in at the desk when you arrive. Bracket and updates: {{4}} | Saturday 8 Ball · today at 7:30 PM · Papas Sports Bar · racker-tracker.com/t/U5BDT2 |
| `rt_your_match_is_up` | RackerTracker | You're up! Your match against {{1}} is ready on table {{2}}. Please head over now. | Alex R. · 3 |
| `hh_estimate_ready` | Handyman quotes | Hi {{1}}, your estimate for {{2}} is ready. Review and approve it here: {{3}} | Pat · deck repair · thehearthhollow.com/quote-approval/… |
| `hh_appointment_reminder` | Handyman quotes | Hi {{1}}, a reminder that The Hearth and Hollow is scheduled for {{2}} on {{3}} ({{4}}). Reply here if anything changes. | Pat · deck repair · Thu Oct 30 · morning |
| `farm_order_ready` | Homestead / farm | Hi {{1}}, your order ({{2}}) is ready for pickup {{3}}. Reply here with any questions. | Pat · 2 dozen eggs · Saturday after 10 AM |

Opt-out line: WhatsApp adds its own block/report controls; inbound "STOP" is also handled by the hub.

Sending from code: `POST /api/comms/whatsapp/send` with `template_name` + `variables` in order
(see WHATSAPP_SETUP.md).
