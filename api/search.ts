import type { VercelRequest, VercelResponse } from '@vercel/node';

// 💡 1. Cold Start를 없애기 위해 Edge 런타임 적용
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q');

  if (!q) {
    return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), { status: 400 });
  }

  const apiKey = process.env.KOREAN_BASIC_DICTIONARY_API_SECRET_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key is missing' }), { status: 500 });
  }

  const baseUrl = 'https://krdict.korean.go.kr/api/search';
  const params = new URLSearchParams({
    key: apiKey,
    q: String(q),
    advanced: 'y',
    method: 'exact',
    target: '1'
  });

  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: '국립국어원 API 요청 실패' }), { status: response.status });
    }

    const xmlData = await response.text();

    // 💡 2. 무거운 XML을 그대로 보내지 않고, 필요한 정보만 정규식으로 쏙 골라내기!
    // total 수치 추출
    const totalMatch = xmlData.match(/<total>(\d+)<\/total>/);
    const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

    // 모든 품사(pos) 추출
    const posMatches = [...xmlData.matchAll(/<pos>(.*?)<\/pos>/g)].map(match => match[1]);
    const hasNoun = posMatches.includes('명사');

    // 프론트엔드가 바로 쓸 수 있게 초경량 JSON으로 리턴!
    return new Response(JSON.stringify({ total, hasNoun }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}