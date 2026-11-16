import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BUDGET, buildPrompt, findArticles, libraryAnswer, urgentAdvice, type ChatTurn } from './local.ts';

test('urgent messages get fixed safety guidance', () => {
  assert.match(urgentAdvice('I fainted and I am soaking a pad every hour') ?? '', /emergency/);
  assert.match(urgentAdvice('sharp shoulder tip pain and my period is late') ?? '', /urgent/);
  assert.match(urgentAdvice('some days I want to kill myself') ?? '', /crisis line/);
  assert.equal(urgentAdvice('why are my cramps worse this month?'), null);
});

test('finds the right article for everyday questions', () => {
  assert.equal(findArticles('Why are my cramps so bad?')[0]?.slug, 'period-pain');
  assert.equal(findArticles('Is a 35 day cycle normal?')[0]?.slug, 'typical-cycle');
  assert.equal(findArticles('hot flushes at night')[0]?.slug, 'hot-flushes');
  assert.deepEqual(findArticles('best pizza in town'), []);
});

test('library answers quote an article and link it', () => {
  const a = libraryAnswer('what helps period pain?');
  assert.equal(a.articles[0].slug, 'period-pain');
  assert.match(a.text, /^From “Period pain: what helps”:/);
  const none = libraryAnswer('tell me a joke');
  assert.equal(none.articles.length, 0);
  assert.match(none.text, /couldn’t find/);
});

test('library answers lead with urgent guidance', () => {
  const a = libraryAnswer('heavy period and I passed out');
  assert.match(a.text.split('\n')[0], /urgent care/);
});

test('prompt keeps recent history within budget and the summary only when shared', () => {
  const long = 'x'.repeat(500);
  const turns: ChatTurn[] = [];
  for (let i = 0; i < 20; i++) turns.push({ role: i % 2 ? 'assistant' : 'user', content: `${i} ${long}` });
  turns.push({ role: 'user', content: 'What helps cramps?' });

  const { instructions, prompt } = buildPrompt(turns, null);
  assert.equal(prompt, 'What helps cramps?');
  const history = instructions.split('Conversation so far:\n')[1];
  assert.ok(history.length <= BUDGET.history + 50);
  assert.match(history, /19 x/); // newest kept
  assert.doesNotMatch(history, /^Person: 0 /m); // oldest dropped
  assert.doesNotMatch(instructions, /About me \(from/);
  assert.match(instructions, /Bloom article \("Period pain/);

  assert.match(buildPrompt([{ role: 'user', content: 'hi' }], 'Average cycle: 29 days').instructions, /About me[^]*29 days/);
});
