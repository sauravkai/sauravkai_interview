import test from 'node:test';
import assert from 'node:assert/strict';

import { setupInterviewSocket } from '../src/sockets/interviewSocket.js';
import { Interview } from '../src/models/Interview.js';

test('end-call does not crash when the room namespace has no socketsLeave helper', async () => {
  const listeners = {};
  let emittedSessionEnded = null;

  Interview.findOneAndUpdate = async () => ({ status: 'ended' });

  const io = {
    on: (event, handler) => {
      if (event === 'connection') {
        listeners.connection = handler;
      }
    },
    in: () => ({
      emit: (eventName, payload) => {
        if (eventName === 'session-ended') {
          emittedSessionEnded = payload;
        }
      },
      fetchSockets: async () => [],
    }),
    to: () => ({ emit: () => {} }),
    sockets: { sockets: new Map() },
  };

  const socket = {
    id: 'socket-123',
    rooms: new Set(['room-42', 'socket-123']),
    data: {},
    emit: () => {},
    on: (event, handler) => {
      listeners[event] = handler;
    },
    join: async () => {},
    leave: async () => {},
    to: () => ({ emit: () => {} }),
  };

  setupInterviewSocket(io);
  await listeners.connection(socket);

  await assert.doesNotReject(async () => {
    await listeners['end-call']({ roomId: 'room-42', user: { name: 'Tester' } });
  });

  assert.equal(emittedSessionEnded.roomId, 'room-42');
  assert.match(emittedSessionEnded.message, /Tester ended the interview/);
});
