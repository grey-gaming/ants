import { describe, test, expect } from 'bun:test';
import * as dbModule from './db';

describe('db — Module Exports', () => {
  test('$db is exported (nullable before init)', () => {
    expect(dbModule.$db).toBeDefined();
  });

  test('connect function is exported', () => {
    expect(typeof dbModule.connect).toBe('function');
  });

  test('disconnect function is exported', () => {
    expect(typeof dbModule.disconnect).toBe('function');
  });

  test('createPool function is exported', () => {
    expect(typeof dbModule.createPool).toBe('function');
  });
});

describe('db — Pool creation', () => {
   test('createPool returns a pool instance', async () => {
     const original = process.env.DATABASE_URL;
     process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

      await dbModule.connect();

      const pool = dbModule.createPool();
      expect(pool).toBeDefined();

      await dbModule.disconnect();

     process.env.DATABASE_URL = original;
    });
   });
