const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');
const app = express();

dotenv.config();
app.use(cors());

let accessToken = '';

// [1] 인증 URL 생성
app.get('/', (req, res) => {
  const { clientId, siteCode, redirectUri } = process.env;
  const scope = 'site-info:write product:read';  // ✅ 필요한 권한만 포함

  const authUrl = `https://openapi.imweb.me/oauth2/authorize?responseType=code&clientId=${clientId}&redirectUri=${redirectUri}&scope=${encodeURIComponent(scope)}&siteCode=${siteCode}`;

  res.send(`<a href="${authUrl}">아임웹 인증하기</a>`);
});

// [2] Callback: 토큰 발급
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('❌ 인가 코드 없음');

  try {
    const payload = new URLSearchParams();
    payload.append('grantType', 'authorization_code');
    payload.append('code', code);
    payload.append('clientId', process.env.clientId);
    payload.append('clientSecret', process.env.clientSecret);
    payload.append('redirectUri', process.env.redirectUri);

    console.log("📌 code:", code);
console.log("📌 client_id:", process.env.clientId);
console.log("📌 client_secret:", process.env.clientSecret);
console.log("📌 redirect_uri:", process.env.redirectUri);

    const response = await axios.post(
      'https://openapi.imweb.me/oauth2/token',
      payload.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    accessToken = response.data.access_token;
    console.log(accessToken)
    res.send('✅ Access Token 저장 완료');
  } catch (err) {
    console.error('❌ 토큰 발급 실패:', err.response?.data || err);
    res.send(`❌ 토큰 발급 실패: ${JSON.stringify(err.response?.data || err)}`);
  }
});

// [3] 상품 재고 조회 (JSONP 지원)
app.get('/stock', async (req, res) => {
  const prodNo = req.query.prodNo;
  const callback = req.query.callback || 'callback';

  if (!prodNo || !accessToken) {
    res.type('text/javascript');
    return res.send(`${callback}({ error: 'Missing prodNo or accessToken' })`);
  }

  try {
    const response = await axios.get(
      `https://api.imweb.me/v2/shop/products/${prodNo}?site_code=${process.env.siteCode}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const stock = response.data?.data?.stockCount || 0;
    const total = response.data?.data?.totalCount || 0;

    res.type('text/javascript');
    res.send(`${callback}(${JSON.stringify({ stock, total })})`);
  } catch (err) {
    console.error('❌ 재고 불러오기 실패:', err.response?.data || err);
    res.type('text/javascript');
    res.send(`${callback}({ error: '재고 불러오기 실패' })`);
  }
});

// [4] 상품 목록 조회 (테스트용)
app.get('/products', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Access token is missing' });
  }

  try {
    const response = await axios.get(
      `https://api.imweb.me/v2/shop/products?siteCode=${process.env.siteCode}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error('❌ 상품 목록 불러오기 실패:', err.response?.data || err);
    res.status(500).json({ error: '상품 목록 불러오기 실패' });
  }
});
app.get('/token', (req, res) => {
  res.send(`현재 저장된 accessToken: ${accessToken}`);
});

const PORT = process.env.port || 3000;
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
