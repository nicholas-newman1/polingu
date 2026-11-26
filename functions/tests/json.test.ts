import { describe, expect, test } from 'vitest';
import { stripMarkdownCodeFences } from '../src/shared/json.js';

describe('stripMarkdownCodeFences', () => {
  test('removes a ```json fence around model output', () => {
    expect(stripMarkdownCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  test('removes a bare ``` fence', () => {
    expect(stripMarkdownCodeFences('```\n[1, 2]\n```')).toBe('[1, 2]');
  });

  test('leaves unfenced output alone apart from surrounding whitespace', () => {
    expect(stripMarkdownCodeFences('  {"a":1}\n')).toBe('{"a":1}');
  });

  test('removes a fence written on a single line', () => {
    expect(stripMarkdownCodeFences('```json{"a":1}```')).toBe('{"a":1}');
  });

  test('removes an opening fence whose closing fence was cut off', () => {
    expect(stripMarkdownCodeFences('```json\n{"a":1}')).toBe('{"a":1}');
  });

  test('removes a fence surrounded by whitespace', () => {
    expect(stripMarkdownCodeFences('\n  ```json\n{"a":1}\n```  \n')).toBe('{"a":1}');
  });

  test('keeps backticks inside the JSON', () => {
    expect(stripMarkdownCodeFences('{"code":"```x```"}')).toBe('{"code":"```x```"}');
  });
});
