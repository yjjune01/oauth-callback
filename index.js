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
  const { CLIENT_ID, SITE_CODE, REDIRECT_URI } = process.env;
  const scope = 'site-info:write product:read';

  // ✅ redirect_uri는 인코딩하지 않음
  const authURL = `https://openapi.imweb.me/oauth2/authorize?response_type=code&clientId=${CLIENT_ID}&redirectUri=${REDIRECT_URI}&scope=${encodeURIComponent(scope)}&siteCode=${SITE_CODE}`;

  res.send(`<a href="${authURL}">아임웹 인증하기</a>`);
});

// [2] Callback: 토큰 발급
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('❌ 인가 코드 없음');

  try {
    const payload = new URLSearchParams();
    payload.append('grant_type', 'authorization_code');
    payload.append('code', code);
    payload.append('client_id', process.env.CLIENT_ID);
    payload.append('client_secret', process.env.CLIENT_SECRET);
    payload.append('redirect_uri', process.env.REDIRECT_URI);

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
      `https://api.imweb.me/v2/shop/products/${prodNo}?site_code=${process.env.SITE_CODE}`,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
