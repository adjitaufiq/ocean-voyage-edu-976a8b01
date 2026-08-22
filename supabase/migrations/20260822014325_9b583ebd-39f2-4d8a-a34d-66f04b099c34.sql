delete from conversation_requirements where conversation_id in (select id from ai_conversations where session_id like 'qa%');
delete from consultations where id in (select lead_id from ai_conversations where session_id like 'qa%' and lead_id is not null);
delete from ai_conversations where session_id like 'qa%';