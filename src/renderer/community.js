// 오류 신고 · 건의 · 공략 제보를 히리온의 디스코드 채널(웹후크)로 보낸다.
// 서버 없이 동작: 디스코드 웹후크는 multipart(form-data)로 받으므로 브라우저의 no-cors 요청으로 보낼 수 있다.
(function (root) {
  'use strict';
  const KINDS = {
    bug: { label: '오류 신고', color: 0xdc2626, emoji: '🐞' },
    idea: { label: '건의', color: 0x5b5bd6, emoji: '💡' },
    tip: { label: '공략 제보', color: 0x16a34a, emoji: '📘' }
  };
  const cut = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  // 디스코드 멘션·링크 남용 막기
  const safe = (s) => String(s || '').replace(/@(everyone|here)/gi, '@​$1').replace(/<@[!&]?\d+>/g, '[멘션]');

  // f = { work, title, body, steps, nick }, ctx = { app, engine, os, url }
  function buildPayload(kind, f, ctx) {
    const k = KINDS[kind] || KINDS.bug;
    const fields = [];
    if (f.work) fields.push({ name: '작품', value: cut(safe(f.work), 200), inline: true });
    if (f.nick) fields.push({ name: '보낸 사람', value: cut(safe(f.nick), 60), inline: true });
    if (ctx) fields.push({ name: '앱', value: cut(`앱 ${ctx.app || '-'} · 엔진 ${ctx.engine || '-'} · ${ctx.os || '-'}`, 200), inline: false });
    if (f.steps) fields.push({ name: '어떻게 하다가', value: cut(safe(f.steps), 1000) });
    return {
      username: 'CRION ' + k.label,
      allowed_mentions: { parse: [] },
      embeds: [{
        title: cut(`${k.emoji} ${f.title ? safe(f.title) : k.label}`, 240),
        description: cut(safe(f.body), 3800) || '(내용 없음)',
        color: k.color,
        fields,
        timestamp: new Date(ctx && ctx.now ? ctx.now : Date.now()).toISOString()
      }]
    };
  }

  // 보낸 기록으로 횟수 제한: 10분에 5번, 하루 30번
  function allowed(history, now) {
    now = now || Date.now();
    const recent = (history || []).filter(h => now - h.at < 10 * 60 * 1000).length;
    const day = (history || []).filter(h => now - h.at < 24 * 3600 * 1000).length;
    if (recent >= 5) return { ok: false, why: '잠시 뒤에 다시 보내 주세요 (10분에 5번까지)' };
    if (day >= 30) return { ok: false, why: '오늘은 더 보낼 수 없어요 (하루 30번까지)' };
    return { ok: true };
  }

  const isWebhook = (u) => /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(String(u || '').trim());

  // 보내기. 응답 내용은 볼 수 없는 방식(no-cors)이라, 네트워크 오류가 없으면 보낸 것으로 본다.
  async function send(webhook, payload, attach, fetchFn) {
    if (!isWebhook(webhook)) throw new Error('받을 곳(웹후크)이 아직 설정되지 않았어요');
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify(payload));
    if (attach && attach.text) fd.append('files[0]', new Blob([attach.text], { type: 'text/plain' }), attach.name || 'diag.txt');
    await (fetchFn || fetch)(String(webhook).trim() + '?wait=false', { method: 'POST', body: fd, mode: 'no-cors' });
    return true;
  }

  // 받을 곳이 없을 때 복사용 글
  function asText(kind, f, ctx) {
    const k = KINDS[kind] || KINDS.bug;
    return [`[CRION ${k.label}]`, f.work ? `작품: ${f.work}` : '', f.title ? `제목: ${f.title}` : '', '', f.body || '', f.steps ? `\n어떻게 하다가: ${f.steps}` : '',
      ctx ? `\n앱 ${ctx.app} · 엔진 ${ctx.engine} · ${ctx.os}` : '', f.nick ? `보낸 사람: ${f.nick}` : ''].filter(x => x !== '').join('\n');
  }

  const api = { KINDS, buildPayload, allowed, isWebhook, send, asText };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionCommunity = api;
})(typeof window !== 'undefined' ? window : globalThis);
