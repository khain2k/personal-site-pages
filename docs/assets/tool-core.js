/* Shared pure transforms. Loaded by site.js and exercised by the Node tests. */
(function (root) {
  'use strict';
  const MAX_LENGTH = 1000000;
  function checked(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('변환할 내용을 입력하세요.');
    if (text.length > MAX_LENGTH) throw new Error('입력은 1,000,000 UTF-16 코드 단위 이하로 제한됩니다.');
    return text;
  }
  function assertSafeNumbers(text) {
    // Replace strings without changing numerical tokens outside strings.
    const withoutStrings = text.replace(/"(?:\\[\s\S]|[^"\\])*"/g, '""');
    const tokens = withoutStrings.match(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g) || [];
    for (const token of tokens) {
      const value = Number(token);
      if (!Number.isFinite(value)) throw new Error(`표현 범위를 초과한 숫자입니다: ${token.slice(0, 60)}`);
      if (Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error(`안전한 정수 범위를 벗어났습니다. 해당 값을 문자열로 표현하세요: ${token.slice(0, 60)}`);
    }
  }
  function jsonTransform(text, operation) {
    checked(text);
    const value = JSON.parse(text);
    assertSafeNumbers(text);
    if (operation === 'validate') return { output: text, message: '문법상 올바른 JSON입니다.' };
    if (!['format', 'minify'].includes(operation)) throw new Error('알 수 없는 JSON 작업입니다.');
    return { output: JSON.stringify(value, null, operation === 'format' ? 2 : 0), message: operation === 'format' ? 'JSON을 정렬했습니다.' : 'JSON을 압축했습니다.' };
  }
  function urlTransform(text, operation) {
    checked(text);
    if (!['encode', 'decode'].includes(operation)) throw new Error('알 수 없는 URL 작업입니다.');
    return { output: operation === 'encode' ? encodeURIComponent(text) : decodeURIComponent(text), message: operation === 'encode' ? 'URL 컴포넌트를 인코딩했습니다.' : 'URL 컴포넌트를 디코딩했습니다.' };
  }
  function unixToTime(input, unit) {
    if (!['seconds','milliseconds'].includes(unit)) throw new Error('초 또는 밀리초 단위를 선택하세요.');
    const raw = String(input).trim();
    if (!/^-?\d+$/.test(raw)) throw new Error('정수 타임스탬프를 입력하세요.');
    const number = Number(raw);
    if (!Number.isSafeInteger(number)) throw new Error('안전한 정수 범위를 벗어났습니다.');
    const milliseconds = unit === 'seconds' ? number * 1000 : number;
    if (!Number.isSafeInteger(milliseconds) || Math.abs(milliseconds) > 8640000000000000) throw new Error('날짜로 변환할 수 있는 범위를 벗어났습니다.');
    const date = new Date(milliseconds);
    return { utc:date.toISOString(), korea:new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date) + ' (Asia/Seoul)', milliseconds };
  }
  function timeToUnix(input) {
    const raw = String(input).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(raw);
    if (!m) throw new Error('예: 2026-09-11T09:00:00+09:00 또는 2026-09-11T00:00:00Z');
    const year=Number(m[1]), month=Number(m[2]), day=Number(m[3]), hour=Number(m[4]), minute=Number(m[5]), second=Number(m[6]);
    const leap=(year%4===0 && year%100!==0) || year%400===0;
    const maxDay=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
    if (!maxDay || day<1 || day>maxDay || hour>23 || minute>59 || second>59) throw new Error('존재하지 않는 날짜 또는 시간입니다.');
    if (m[8]!=='Z') {
      const offset=m[8].slice(1).split(':').map(Number);
      if (offset[0]>23 || offset[1]>59) throw new Error('UTC 오프셋이 올바르지 않습니다.');
    }
    const milliseconds=Date.parse(raw);
    if (!Number.isFinite(milliseconds)) throw new Error('날짜를 해석할 수 없습니다.');
    return { milliseconds, seconds:Math.floor(milliseconds/1000) };
  }
  root.PersonalTools = { jsonTransform, urlTransform, unixToTime, timeToUnix };
})(globalThis);
