// api/search.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 프론트엔드에서 보낸 단어(q) 가져오기
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  // Vite 환경변수가 아닌, 실제 서버 환경변수(process.env)에서 키를 가져옵니다. (브라우저 노출 안 됨)
  const apiKey = process.env.KOREAN_BASIC_DICTIONARY_API_SECRET_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key is missing in server environment' });
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
      return res.status(response.status).json({ error: '국립국어원 API 요청 실패' });
    }

    // 국어사전 API는 XML을 반환하므로 text로 받아 그대로 전달합니다.
    const xmlData = await response.text();
    
    res.setHeader('Content-Type', 'application/xml');
    return res.status(200).send(xmlData);
  } catch (error) {
    console.error("서버 에러:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}