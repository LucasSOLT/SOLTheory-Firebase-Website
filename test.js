const text = 'can you write an email to Steve Huff and Cinema Google meet link for tomorrow at 10:00 p.m.';
const lower = text.toLowerCase();
if (lower.includes('email') || lower.includes('write a letter') || lower.includes('send a message to')) {
  let recipientName = '';
  const namePatterns = [
    /(?:his|her|their) name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
    /(?:named|name is) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
    /email (?:to|for) (?:my \w+[,.]?\s*(?:and )?)?(?:(?:his|her|their) name is )?([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
    /email (?:to|for) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
  ];
  for (const p of namePatterns) {
    const m = text.match(p);
    if (m?.[1]) { recipientName = m[1].trim(); break; }
  }
  const timeMatch = text.match(/(?:at|for|tomorrow at|today at) (\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i);
  const meetLinkMentioned = lower.includes('meet link') || lower.includes('google meet') || lower.includes('meeting link');

  console.log(JSON.stringify({
    type: 'email',
    data: {
      to: recipientName,
      subject: meetLinkMentioned ? 'Meeting with ' + (recipientName || 'Participant') : '',
      greeting: recipientName ? 'Hello ' + recipientName.split(' ')[0] + ',' : 'Hello,',
      body: meetLinkMentioned ? "I'd like to invite you to a meeting" + (timeMatch ? ' at ' + timeMatch[1] : '') + '. Please find the Google Meet link below.' : 'Composing your email' + (recipientName ? ' to ' + recipientName : '') + '...',
      closing: 'Thanks,',
      senderName: '',
    }
  }, null, 2));
} else {
  console.log('No email detected');
}
