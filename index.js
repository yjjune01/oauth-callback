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
  const scope = 'site-info:write product:read';

  const authURL = `https://openapi.imweb.me/oauth2/authorize?responseType=code&clientId=${clientId}&redirectUri=${redirectUri}&scope=${encodeURIComponent(scope)}&siteCode=${siteCode}`;

  res.send(`<a href="${authURL}">아임웹 인증하기</a>`);
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
    res.send('✅ Access Token 저장 완료');
  } catch (err) {
    console.error('❌ 토큰 발급 실패:', err.response?.data || err);
    res.send(`❌ 토큰 발급 실패: ${JSON.stringify(err.response?.data || err)}`);
  }
});

// [3] 상품 재고 확인 (JSONP)
app.get('/stock', async (req, res) => {
  const prodNo = req.query.prodNo;
  const callback = req.query.callback || 'callback';

  if (!prodNo || !accessToken) {
    res.type('text/javascript');
    return res.send(`${callback}({ error: 'Missing prodNo or accessToken' })`);
  }

  try {
    const response = await axios.get(
      `https://api.imweb.me/v2/shop/products/${prodNo}?siteCode=${process.env.siteCode}`,
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
    console.error(err.response?.data || err);
    res.type('text/javascript');
    res.send(`${callback}({ error: '재고 불러오기 실패' })`);
  }
});

const PORT = process.env.port || 3000;
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
