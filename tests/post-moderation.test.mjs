import assert from 'node:assert/strict'
import test from 'node:test'
import { moderatePost } from '../src/lib/post-moderation.ts'

const blocked = {
  abusive_language: [
    'That is fucking awful.', 'This is sh1t.', 'That was f.u.c.k.',
    'That is f u c k.', 'This is fuuuck.', 'That is b!tch.',
    'You are worthless.', 'This is sh\u200bit.',
  ],
  phone_number: [
    'Call me on 2025550123.', 'My number is +44 (7700) 900-123.',
    'Call (202) 555-0123.', 'Please call 555.0123.',
    'Call ２０２５５５０１２３.', 'My number is two zero two five five five zero one two three.',
  ],
  personal_information: [
    'Write to me at hello@example.com.', 'Find me at @quiet_person.',
    'My father lives at 123 Maple Street.', 'Find my brother at https://example.com/profile.',
  ],
  personal_name: [
    'My father John taught me kindness.', 'My brother, Michael, listens.',
    'Sarah helped me today.', 'john smith was there for me.',
    'My mother, Aisha, listens.',
  ],
  money_request: ['Please send me money.', 'Donate to my fundraiser.'],
  hateful_content: ['I hate all immigrants.'],
}

for (const [code, examples] of Object.entries(blocked)) {
  for (const text of examples) {
    test(`screens ${code}: ${text}`, () => {
      assert.equal(moderatePost(text)?.code, code)
    })
  }
}

test('offers a single actionable wording correction for profanity and insults', () => {
  for (const text of blocked.abusive_language) {
    assert.equal(moderatePost(text)?.message, 'Please rephrase this without profanity, slurs, or personal insults.')
  }
})

for (const text of [
  'My father taught me kindness.', 'My brother is always there for me.',
  'My mother listens without judging.', 'My sister called me yesterday.',
  'My partner and I are learning to listen.', 'A friend reminded me to slow down.',
  'My grandmother used to say that patience matters.', 'Hope is a quiet thing.',
  'I passed a beautiful garden today.', 'A class on compassion changed my perspective.',
  'I took 10 minutes to breathe today.', 'I felt grateful for my colleague.',
]) {
  test(`allows anonymous reflection: ${text}`, () => assert.equal(moderatePost(text), null))
}
