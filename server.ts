import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodeFetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

dotenv.config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3001;

const apiKey = process.env.VITE_API_KEY || '';

// Proxy agent for bypassing GFW
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || 'http://127.0.0.1:7897';
const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

console.log(`Proxy: ${proxyUrl || 'none'}`);

app.use(cors());
app.use(express.json());

// Helpers
function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

function parseRetryDelay(errorBody: string): number | null {
    try {
        const parsed = JSON.parse(errorBody);
        const retryInfo = parsed?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
            const seconds = parseFloat(retryInfo.retryDelay);
            if (!isNaN(seconds)) return Math.ceil(seconds * 1000);
        }
        // Fallback: parse "Please retry in Xs" from message
        const match = parsed?.error?.message?.match(/retry in ([\d.]+)s/i);
        if (match) return Math.ceil(parseFloat(match[1]) * 1000);
    } catch { /* ignore */ }
    return null;
}

// Direct REST API call to Gemini via node-fetch + proxy agent
// with automatic retry on 429 (rate limit)
async function callGeminiAPI(model: string, contents: string, maxRetries = 2): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{ parts: [{ text: contents }] }]
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const response = await nodeFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            agent: agent,
        });

        if (response.ok) {
            const data = await response.json() as any;
            return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        const errorBody = await response.text();

        // Handle 429 rate limit with retry
        if (response.status === 429 && attempt < maxRetries) {
            const delayMs = parseRetryDelay(errorBody) || (30000 * (attempt + 1));
            console.log(`Rate limited (429). Retrying in ${Math.round(delayMs / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`);
            await sleep(delayMs);
            continue;
        }

        // Parse friendly error messages for known codes
        try {
            const parsed = JSON.parse(errorBody);
            const code = parsed?.error?.code;
            const msg = parsed?.error?.message || '';

            if (code === 429) {
                throw new Error('AI 请求过于频繁，已超出免费额度限制。请稍等片刻后重试，或升级为付费计划。');
            }
            if (code === 400 && msg.includes('location')) {
                throw new Error('当前网络环境不受 Gemini API 支持，请切换代理节点至美国/日本等支持地区。');
            }
            throw new Error(msg || errorBody);
        } catch (e: any) {
            if (e.message.startsWith('AI ') || e.message.startsWith('当前')) throw e;
            throw new Error(errorBody);
        }
    }
    throw new Error('AI 请求失败，已达最大重试次数。');
}

// Proxy endpoint for Gemini
app.post('/api/gemini', async (req, res) => {
    const { model: modelTitle, contents } = req.body;

    if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API Key 未配置，请在 .env.local 中设置 VITE_API_KEY。' });
    }

    try {
        console.log(`Request for model: ${modelTitle}`);
        const responseText = await callGeminiAPI(modelTitle || 'gemini-2.5-flash', contents);
        res.json({ text: responseText });
    } catch (error: any) {
        console.error('Gemini Proxy Error:', error.message);
        res.status(500).json({ error: error.message || 'AI 服务暂时不可用，请稍后重试。' });
    }
});

app.listen(port, () => {
    console.log(`Gemini Proxy Server running at http://localhost:${port}`);
});
