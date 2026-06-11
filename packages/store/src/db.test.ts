import { describe, test, expect } from 'bun:test';
import * as dbModule from './db';

describe('db — Module Exports', () => {
  test('$db is exported', () => {
    expect(dbModule.$db).not.toBeNull();
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
  test('createPool returns a pool instance', () => {
    const url = 'postgresql://test:test@localhost:5432/test';
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;

    const pool = dbModule.createPool();
    expect(pool).toBeDefined();

    process.env.DATABASE_URL = original;
  });
});
