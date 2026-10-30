import nlp from 'compromise'

type Rejection = { code: string; message: string }

const disguisedProfanity = new RegExp(
  '\\b(?:' + ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'bastard', 'dick', 'wanker', 'slut', 'whore', 'faggot', 'nigger', 'twat', 'prick']
    .map(word => [...word].join('[\\W_]*')).join('|') + ')\\b', 'i',
)
const additionalProfanity = /\b(?:ass|asses|cock|cocks|twat|twats|prick|pricks)\b/i
const phoneNumber = /(?:\+?\d[\s().-]*){7,}/
const spokenPhoneNumber = /\b(?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)[\s,.-]+){6,}(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/i
const contactDetails = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/,
  /(?:^|\s)@[\p{L}\p{N}_][\p{L}\p{N}_.-]*/u,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b\d+[a-z]?\s+(?:[\p{L}.'-]+\s+){0,5}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|close)\b/iu,
]

const language = /\b(?:fuck(?:ing|ed|er|ers|s)?|motherfuck(?:er|ers|ing)?|shit(?:ty|head|s)?|bullshit|bitch(?:es|y)?|asshole(?:s)?|bastard(?:s)?|cunt(?:s)?|dick(?:head)?(?:s)?|dumbass(?:es)?|damn(?:ed)?|goddamn|crap|piss(?:ed)?|wanker(?:s)?|slut(?:s)?|whore(?:s)?|idiot(?:s|ic)?|moron(?:s|ic)?|imbecile(?:s)?|retard(?:ed|s)?|faggot(?:s)?|nigg(?:er|ers|a|as)|kike(?:s)?)\b/i
const targetedAbuse = /\b(?:you(?:'re| are|r)?\s+(?:a\s+)?(?:stupid|pathetic|worthless|disgusting|ugly|loser)|shut\s+up|go\s+to\s+hell|kill\s+yourself|kys)\b/i
const groups = '(?:black people|white people|jews|jewish people|muslims|christians|immigrants|refugees|gay people|lesbians|trans people|women|men|disabled people)'
const hate = [
  new RegExp(`\\b(?:kill|exterminate|deport|eradicate|hate|attack|ban)\\s+(?:all\\s+|the\\s+|those\\s+)?${groups}\\b`, 'i'),
  new RegExp(`\\b${groups}\\s+(?:are|should be)\\s+(?:all\\s+)?(?:inferior|vermin|subhuman|parasites|disgusting|killed|dead|exterminated)\\b`, 'i'),
]
const solicitation = [
  /\b(?:send|give|lend|loan|transfer|wire|pay|donate|gift)\s+(?:(?:me|us|to me|to us)\s+)?(?:some\s+|your\s+|any\s+)?(?:money|cash|funds|bitcoin|crypto|dollars|euros|pounds)\b/i,
  /\b(?:send|give|lend|loan|transfer|wire|pay|donate|gift)\b.{0,35}(?:[$€£]\s*\d+(?:\.\d+)?|\d+\s*(?:dollars|euros|pounds|usd|eur|gbp))\b/i,
  /\b(?:paypal\.me|gofundme\.com|ko-fi\.com|buymeacoffee\.com|cash\.app|venmo\.com|patreon\.com)\b/i,
  /\b(?:donate|donation|donations|fundraiser|fundraising|crowdfunding|cashapp|cash app)\b/i,
  /\b(?:support|fund|sponsor)\s+(?:me|us|my|our)\b.{0,45}\b(?:financially|money|cash|rent|bills|campaign|project|wallet)\b/i,
  /\b(?:need|asking for|begging for|please help with)\s+(?:some\s+)?(?:money|cash|funds|donations|financial help)\b/i,
  /\b(?:help|assist)\s+(?:me|us)\s+(?:to\s+)?(?:pay|cover|raise|fund)\b/i,
]

export function moderatePost(text: string): Rejection | null {
  const clean = text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[’‘]/g, "'")
  const normalized = clean.toLowerCase()
  const decoded = normalized.replace(/[013457@$!|]/g, c => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'i' })[c]!)
  const variants = [normalized, decoded, decoded.replace(/(.)\1{2,}/g, '$1')]
  if (variants.some(value => hate.some(pattern => pattern.test(value)))) {
    return { code: 'hateful_content', message: 'Please revise your thought. Hateful or discriminatory language isn’t allowed.' }
  }
  if (variants.some(value => language.test(value) || targetedAbuse.test(value) || additionalProfanity.test(value) || disguisedProfanity.test(value))) {
    return { code: 'abusive_language', message: 'Please rephrase this without profanity, slurs, or personal insults.' }
  }
  if (solicitation.some(pattern => pattern.test(normalized))) {
    return { code: 'money_request', message: 'Please revise your thought. Requests for money, donations, or financial support aren’t allowed.' }
  }
  if (phoneNumber.test(normalized) || spokenPhoneNumber.test(normalized)) {
    return { code: 'phone_number', message: 'Let’s keep this private. Please remove telephone numbers from your thought.' }
  }
  if (contactDetails.some(pattern => pattern.test(clean))) {
    return { code: 'personal_information', message: 'Please leave out email addresses, social handles, links, and street addresses. Share the feeling without details that could identify someone.' }
  }
  // Name recognition is a first pass, not proof of anonymity; independent human review remains required.
  if (nlp(clean).people().found) {
    return { code: 'personal_name', message: 'Could you describe your relationship instead of using a name? Try “my father,” “my brother,” or “a friend,” and leave out identifying details.' }
  }
  return null
}
