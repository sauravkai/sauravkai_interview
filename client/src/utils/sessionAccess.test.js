import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserScopedHistoryKey, isSessionJoinAllowed, isSessionVisibleInUpcomingList, isHistoryStatusVisible, normalizeQuestionCount, removeCancelledInterviewFromState, resolveParticipantEmail, resolveParticipantName } from './sessionAccess.js';

test('completed sessions cannot be rejoined', () => {
  assert.equal(isSessionJoinAllowed('completed'), false);
  assert.equal(isSessionJoinAllowed('finished'), false);
});

test('inactive or ended items are hidden from upcoming lists', () => {
  assert.equal(isSessionVisibleInUpcomingList({ isActive: false }), false);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'completed' }), false);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'cancelled' }), false);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'canceled' }), false);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'ended' }), false);
  assert.equal(isSessionVisibleInUpcomingList({ completedAt: '2026-01-01T00:00:00Z' }), false);
  assert.equal(isSessionVisibleInUpcomingList({ type: 'login', isActive: true }), false);
  assert.equal(isSessionVisibleInUpcomingList({ type: 'logout', isActive: true }), false);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'scheduled', scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }), true);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'scheduled', scheduledAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), durationMinutes: 45 }), true);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'scheduled', scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), durationMinutes: 30 }), false);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'scheduled', scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), sessionEnd: new Date(Date.now() - 30 * 60 * 1000).toISOString() }), false);
  assert.equal(isSessionVisibleInUpcomingList({ status: 'live' }), true);
});

test('active sessions can still be joined', () => {
  assert.equal(isSessionJoinAllowed('in-progress'), true);
  assert.equal(isSessionJoinAllowed('scheduled'), true);
  assert.equal(isSessionJoinAllowed('live'), true);
  assert.equal(isSessionJoinAllowed('cancelled'), false);
});

test('sessions are joinable within their active window and upcoming scheduled sessions remain visible', () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const active = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const expired = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  assert.equal(isSessionJoinAllowed({ status: 'scheduled', scheduledAt: future, durationMinutes: 45 }), true);
  assert.equal(isSessionJoinAllowed({ status: 'scheduled', scheduledAt: active, durationMinutes: 45 }), true);
  assert.equal(isSessionJoinAllowed({ status: 'scheduled', scheduledAt: future, endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }), true);
  assert.equal(isSessionJoinAllowed({ status: 'scheduled', scheduledAt: expired, durationMinutes: 30 }), false);
  assert.equal(isSessionJoinAllowed({ status: 'in-progress', scheduledAt: expired, durationMinutes: 30 }), false);
});

test('user-scoped history keys are isolated per account', () => {
  const first = getUserScopedHistoryKey('previousInterviewReports', { email: 'alpha@example.com' });
  const second = getUserScopedHistoryKey('previousInterviewReports', { email: 'beta@example.com' });

  assert.notEqual(first, second);
  assert.equal(first, 'previousInterviewReports_alpha_example_com');
});

test('cancelled interviews are kept in the history list and marked as cancelled', () => {
  assert.equal(isHistoryStatusVisible({ status: 'cancelled' }), true);
  assert.equal(isHistoryStatusVisible({ status: 'completed' }), true);
  assert.equal(isHistoryStatusVisible({ status: 'scheduled' }), true);
  assert.equal(isHistoryStatusVisible({ status: 'live' }), false);
});

test('cancelled interviews are removed from both active interview and session lists', () => {
  const interviews = [
    { _id: 'a', title: 'Interview A' },
    { _id: 'b', title: 'Interview B' },
  ];

  const sessions = [
    { roomId: 'a', type: 'interview' },
    { roomId: 'c', type: 'interview' },
  ];

  const result = removeCancelledInterviewFromState(interviews, sessions, 'a');

  assert.deepEqual(result.interviews, [{ _id: 'b', title: 'Interview B' }]);
  assert.deepEqual(result.sessions, [{ roomId: 'c', type: 'interview' }]);
});

test('question counts are normalized to a stable positive integer instead of random default fallbacks', () => {
  assert.equal(normalizeQuestionCount('1'), 1);
  assert.equal(normalizeQuestionCount(0, 2), 2);
  assert.equal(normalizeQuestionCount(undefined, 3), 3);
  assert.equal(normalizeQuestionCount('5.9'), 5);
  assert.equal(normalizeQuestionCount('abc', 4), 4);
});

test('participant emails and names are resolved from nested objects as well as flat fields', () => {
  const record = {
    candidateName: 'Candidate Name',
    candidate: { email: 'candidate@gmail.com' },
    interviewer: { name: 'Jane Interviewer', email: 'jane@company.com' },
  };

  assert.equal(resolveParticipantEmail(record), 'candidate@gmail.com');
  assert.equal(resolveParticipantName(record), 'Candidate Name');
  assert.equal(resolveParticipantEmail({ interviewer: { email: 'jane@company.com' } }), 'jane@company.com');
});
