# LLM Free API Providers Research

A comprehensive analysis of free LLM API providers and reverse-engineered API solutions for CLI tool integration.

**Research Date:** March 21, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [FREEGLM](#1-freeglm)
3. [GLM-Free-API (xiaoY233)](#2-glm-free-api-xiaoy233)
4. [qwen-free-api](#3-qwen-free-api)
5. [glm-free-api (LLM-Red-Team)](#4-glm-free-api-llm-red-team)
6. [minimax-free-api](#5-minimax-free-api)
7. [gpt4free-ts](#6-gpt4free-ts)
8. [Comparative Analysis](#comparative-analysis)
9. [Integration Recommendations](#integration-recommendations)

---

## Executive Summary

This research document analyzes six repositories that provide free access to LLM APIs through reverse-engineering techniques. These projects enable developers to use various LLM models without official API costs, though they come with stability, legal, and ethical considerations.

| Project | Provider | Models | API Compatibility | Deployment |
|---------|----------|--------|-------------------|------------|
| FREEGLM | GLM-4 (via proxy) | GLM-4 | Custom Web UI | Node.js |
| GLM-Free-API (xiaoY233) | Zhipu AI | GLM-4-Plus, GLM-4.5+, GLM-4.6, GLM-4.7 | OpenAI, Gemini, Claude | Docker/Node.js |
| qwen-free-api | Alibaba (Qwen) | Qwen series | OpenAI | Docker/Node.js/Vercel |
| glm-free-api | Zhipu AI | GLM-4-Plus, GLM-4-Zero | OpenAI | Docker/Node.js/Vercel |
| minimax-free-api | MiniMax (Hailuo) | MiniMax-Text-01, MiniMax-VL-01 | OpenAI | Docker/Node.js/Vercel |
| gpt4free-ts | Multiple | GPT-3.5, GPT-4, Claude, Llama, etc. | OpenAI | Docker/Node.js |

---

## 1. FREEGLM

**Repository:** [wangshengithub/FREEGLM](https://github.com/wangshengithub/FREEGLM)

### Core Purpose

FREEGLM is a free AI conversation tool based on GLM-4 that requires no configuration to run locally. It acts as a local proxy server to bypass CORS restrictions and provide access to GLM-4 capabilities.

### Models Provided

- **GLM-4** (via third-party API endpoint `v8.qqslyx.com`)

### API Compatibility

- **Custom Web UI** - Built-in web interface at `http://localhost:33333`
- **SSE Streaming** - Server-Sent Events for real-time responses
- **Not OpenAI-compatible** - Uses custom implementation

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Frontend | Custom HTML/JS |
| Streaming | SSE (Server-Sent Events) |

### Authentication Requirements

- **None required** - Uses built-in proxy to handle authentication automatically
- Cookies and session management handled internally

### Deployment

```bash
# Clone and install
git clone https://github.com/wangshengithub/FREEGLM
cd FREEGLM
npm install
npm start

# Access at http://localhost:33333
```

### Rate Limits & Constraints

- Depends on upstream API (`v8.qqslyx.com`) availability
- No explicit rate limiting documented
- Network must be able to access the upstream API endpoint

### CLI Integration Potential

**Low** - This project is designed as a web UI, not an API server. It lacks:
- OpenAI-compatible endpoints
- Programmatic access methods
- CLI-friendly interfaces

### Reliability & Maintenance

| Aspect | Status |
|--------|--------|
| Last Updated | Active (2024) |
| Maintenance | Personal project |
| Upstream Dependency | Third-party API (unstable) |
| Security Concerns | Data forwarded to third-party servers |

### Key Warnings

- Non-official product with no affiliation to GLM
- Data privacy risks - messages forwarded to third-party servers
- Service availability depends on upstream API stability

---

## 2. GLM-Free-API (xiaoY233)

**Repository:** [xiaoY233/GLM-Free-API](https://github.com/xiaoY233/GLM-Free-API)

### Core Purpose

A fork/modification of the LLM-Red-Team glm-free-api project with security fixes and updated model support. This version removes malicious code found in the original project.

### Models Provided

| Model | Description |
|-------|-------------|
| GLM-4-Plus | Default high-speed model |
| GLM-4.5, GLM-4.5-x, GLM-4.5-air | Legacy models (deprecated) |
| GLM-4.6, GLM-4.6v | Current generation |
| GLM-4.7 | Latest model |
| GLM-4-Zero / GLM-4-Think | Reasoning models |
| GLM-4-DeepResearch | Deep research model |

### API Compatibility

| API Type | Endpoint | Compatibility |
|----------|----------|---------------|
| OpenAI | `/v1/chat/completions` | Full compatibility |
| Google Gemini | `/v1beta/models/:model:generateContent` | Gemini-cli compatible |
| Anthropic Claude | `/v1/messages` | Claude-code compatible |

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Container | Docker |
| Image | `akashrajpuroh1t/glm-free-api-fix:latest` |

### Authentication Requirements

- **Refresh Token** from [智谱清言](https://chatglm.cn/)
- Obtain from browser cookies: `chatglm_refresh_token`
- Format: `Authorization: Bearer TOKEN`
- Multi-account support: `Bearer TOKEN1,TOKEN2,TOKEN3`

### Deployment

**Docker:**
```bash
docker run -it -d --init --name glm-free-api \
  -p 8000:8000 -e TZ=Asia/Shanghai \
  akashrajpuroh1t/glm-free-api-fix:latest
```

**Docker Compose:**
```yaml
version: '3'
services:
  glm-free-api:
    container_name: glm-free-api
    image: akashrajpuroh1t/glm-free-api-fix:latest
    restart: always
    ports:
      - "8000:8000"
    environment:
      - TZ=Asia/Shanghai
```

### Features

- ✅ High-speed streaming output
- ✅ Multi-turn conversation
- ✅ Agent/smart body conversation
- ✅ Zero reasoning model support
- ✅ Video generation
- ✅ AI drawing
- ✅ Web search
- ✅ Long document analysis
- ✅ Image parsing
- ✅ Gemini-cli adapter
- ✅ Claude-code adapter

### Rate Limits & Constraints

- Same account limited to one concurrent output
- Use multiple accounts for parallel requests
- Token validity can be checked via `/token/check` endpoint

### CLI Integration Potential

**High** - Excellent CLI integration capabilities:
- OpenAI-compatible API endpoints
- Gemini and Claude adapters built-in
- Standard Bearer token authentication
- Streaming support (SSE)

### Reliability & Maintenance

| Aspect | Status |
|--------|--------|
| Version | v1.0.2 (2025-02-05) |
| Security | Malicious code removed |
| Maintenance | Active fork |
| Note | Original project deprecated |

### Security Advisory

The original LLM-Red-Team/glm-free-api contained malicious code in `src/api/chat.js`. This fork has removed the malicious code and is recommended over the original.

---

## 3. qwen-free-api

**Repository:** [LLM-Red-Team/qwen-free-api](https://github.com/LLM-Red-Team/qwen-free-api)

### Core Purpose

Provides free API access to Alibaba's Qwen (通义千问) models through reverse-engineering the Tongyi Qianwen web interface.

### Models Provided

| Model | Description |
|-------|-------------|
| qwen | Default Qwen model |
| qwen-turbo | Fast variant |
| qwen-plus | Enhanced variant |
| qwen-max | Maximum capability |

Note: Model names are flexible - the actual model used depends on the web interface session.

### API Compatibility

| API Type | Endpoint | Notes |
|----------|----------|-------|
| OpenAI Chat | `/v1/chat/completions` | Full compatibility |
| OpenAI Images | `/v1/images/generations` | AI drawing support |

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Container | Docker |
| Image | `vinlic/qwen-free-api:latest` |
| Deployment | Docker, Render, Vercel |

### Authentication Requirements

**Method 1 - Tongyi SSO Ticket:**
1. Login to [通义千问](https://tongyi.aliyun.com/qianwen)
2. Open DevTools > Application > Cookies
3. Extract `tongyi_sso_ticket` value

**Method 2 - Aliyun Login Ticket:**
1. Login to [阿里云](https://www.aliyun.com/)
2. Extract `login_aliyunid_ticket` from cookies

**Multi-account:**
```
Authorization: Bearer TOKEN1,TOKEN2,TOKEN3
```

### Deployment

**Docker:**
```bash
docker run -it -d --init --name qwen-free-api \
  -p 8000:8000 -e TZ=Asia/Shanghai \
  vinlic/qwen-free-api:latest
```

**Native (PM2):**
```bash
npm i
npm i -g pm2
npm run build
pm2 start dist/index.js --name "qwen-free-api"
```

### Features

- ✅ High-speed streaming output
- ✅ Multi-turn conversation
- ✅ Watermark-free AI drawing
- ✅ Long document analysis
- ✅ Image parsing
- ✅ Conversation ID for context continuation

### API Examples

**Chat Completion:**
```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "model": "qwen",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

**Image Generation:**
```bash
curl http://localhost:8000/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"model": "wanxiang", "prompt": "一只可爱的猫"}'
```

### Rate Limits & Constraints

- Token statistics return fixed numbers (not accurate)
- Check token validity: `POST /token/check`
- Recommended check interval: > 10 minutes

### CLI Integration Potential

**High** - Well-suited for CLI integration:
- Standard OpenAI-compatible endpoints
- Simple Bearer token authentication
- Streaming support
- Image generation capabilities

### Reliability & Maintenance

| Aspect | Status |
|--------|--------|
| Docker Pulls | High volume |
| License | MIT |
| Maintenance | Active (LLM-Red-Team) |
| Stability | Depends on upstream changes |

---

## 4. glm-free-api (LLM-Red-Team)

**Repository:** [LLM-Red-Team/glm-free-api](https://github.com/LLM-Red-Team/glm-free-api)

### Core Purpose

Original GLM free API project from LLM-Red-Team. **WARNING: This project contains malicious code and is not recommended.** Use the xiaoY233 fork instead.

### Models Provided

| Model | Description |
|-------|-------------|
| glm-4-plus | Default model |
| glm-4-zero / glm-4-think | Reasoning models |
| glm-4-deepresearch | Research model |
| Agent IDs | Custom agent support |

### API Compatibility

- **OpenAI Chat Completions** - `/v1/chat/completions`
- **OpenAI Images** - `/v1/images/generations`
- **Video Generation** - `/v1/videos/generations`

### Security Warning

⚠️ **CRITICAL: This repository contains malicious code**

The file `src/api/chat.js` contains obfuscated malicious code. The xiaoY233/GLM-Free-API fork has removed this code and is the recommended alternative.

### Features

- ✅ GLM-4-Plus streaming
- ✅ Multi-turn conversation
- ✅ Agent conversation
- ✅ Video generation
- ✅ AI drawing
- ✅ Web search
- ✅ Document analysis
- ✅ Image parsing
- ✅ Code execution

### Deployment

**Not recommended** - Use xiaoY233/GLM-Free-API instead.

If still required:
```bash
docker run -it -d --init --name glm-free-api \
  -p 8000:8000 -e TZ=Asia/Shanghai \
  vinlic/glm-free-api:latest
```

### CLI Integration Potential

**Not Recommended** - Security concerns make this unsuitable for production use.

### Reliability & Maintenance

| Aspect | Status |
|--------|--------|
| Security | ⚠️ Contains malicious code |
| Recommendation | Use xiaoY233 fork |
| Maintenance | Original author account suspended |

---

## 5. minimax-free-api

**Repository:** [LLM-Red-Team/minimax-free-api](https://github.com/LLM-Red-Team/minimax-free-api)

### Core Purpose

Provides free API access to MiniMax's Hailuo AI (海螺AI) models, including text generation, voice synthesis, and voice recognition.

### Models Provided

| Model | Description |
|-------|-------------|
| MiniMax-Text-01 | Primary text model |
| MiniMax-VL-01 | Vision-language model |
| hailuo | Default alias |

### API Compatibility

| API Type | Endpoint | Notes |
|----------|----------|-------|
| OpenAI Chat | `/v1/chat/completions` | Full compatibility |
| OpenAI Audio Speech | `/v1/audio/speech` | TTS synthesis |
| OpenAI Audio Transcriptions | `/v1/audio/transcriptions` | Speech-to-text |

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Container | Docker |
| Image | `vinlic/minimax-free-api:latest` |
| Note | Formerly `vinlic/hailuo-free-api` |

### Authentication Requirements

1. Visit [海螺AI](https://hailuoai.com/)
2. Start a conversation
3. Open DevTools > Application > LocalStorage
4. Extract `_token` value
5. Format: `Authorization: Bearer TOKEN`

**Multi-account:**
```
Authorization: Bearer TOKEN1,TOKEN2,TOKEN3
```

### Deployment

**Docker:**
```bash
docker run -it -d --init --name minimax-free-api \
  -p 8000:8000 -e TZ=Asia/Shanghai \
  vinlic/minimax-free-api:latest
```

**Docker Compose:**
```yaml
version: '3'
services:
  minimax-free-api:
    container_name: minimax-free-api
    image: vinlic/minimax-free-api:latest
    restart: always
    ports:
      - "8000:8000"
    environment:
      - TZ=Asia/Shanghai
```

### Features

- ✅ High-speed streaming output
- ✅ Multi-turn conversation
- ✅ Voice synthesis (TTS)
- ✅ Voice recognition (STT)
- ✅ Web search
- ✅ Long document analysis
- ✅ Image parsing

### Voice Synthesis (TTS)

**Official Voice Options:**
| Voice ID | Name | OpenAI Mapping |
|----------|------|----------------|
| male-botong | 思远 | alloy |
| Podcast_girl | 心悦 | echo |
| boyan_new_hailuo | 子轩 | fable |
| female-shaonv | 灵儿 | onyx |
| YaeMiko_hailuo | 语嫣 | nova |
| xiaoyi_mix_hailuo | 少泽 | shimmer |

**Custom Voice Mapping:**
```bash
# Environment variable
REPLACE_AUDIO_MODEL="Podcast_girl,yueyue_hailuo,keli_hailuo"
```

**API Example:**
```bash
curl http://localhost:8000/v1/audio/speech \
  -H "Authorization: Bearer TOKEN" \
  -d '{"model": "hailuo", "input": "你好", "voice": "Podcast_girl"}' \
  --output speech.mp3
```

### Voice Recognition (STT)

```bash
curl http://localhost:8000/v1/audio/transcriptions \
  -H "Authorization: Bearer TOKEN" \
  -F file="@audio.mp3" \
  -F model="hailuo"
```

### Rate Limits & Constraints

- Same account limited to one concurrent output
- Token check: `POST /token/check`
- Minimum check interval: 10 minutes

### CLI Integration Potential

**Very High** - Excellent for CLI tools:
- OpenAI-compatible chat API
- Built-in TTS capabilities
- Speech recognition support
- Multi-modal features

### Reliability & Maintenance

| Aspect | Status |
|--------|--------|
| Docker Pulls | Active |
| License | MIT |
| Maintenance | Active (LLM-Red-Team) |
| Features | Most comprehensive |

---

## 6. gpt4free-ts

**Repository:** [xiangsx/gpt4free-ts](https://github.com/xiangsx/gpt4free-ts)

### Core Purpose

A TypeScript implementation providing free access to multiple LLM providers through reverse-engineering various web interfaces. Aggregates multiple providers for redundancy.

### Models Provided

| Provider | Models |
|----------|--------|
| OpenAI | gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4 |
| Anthropic | claude-1-100k, claude-2-100k |
| Google | palm, gemini |
| Meta | llama-2-70b, llama-2-13b, llama-2-7b |
| Code Llama | code-llama-34b, code-llama-13b, code-llama-7b |
| Alibaba | qwen-72b |
| Mistral | mixtral-8x7b, mistral-medium |
| Stability AI | stable-diffusion |

### Reverse Engineering Targets

The project aggregates multiple reverse-engineered endpoints:

| Site | Models Available |
|------|------------------|
| you | gpt-3.5-turbo |
| phind | net-gpt-3.5-turbo |
| forefront | gpt-3.5-turbo, claude |
| fakeopen | gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4 |
| better | gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4 |
| magic | gpt-3.5-turbo, gpt-4, claude, claude-100k |
| cursor | gpt-3.5-turbo, gpt-4 |
| claude | claude-2-100k |

### API Compatibility

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | OpenAI-compatible (with site param) |
| `/:site/v1/chat/completions` | POST | Site-specific OpenAI-compatible |
| `/ask` | GET/POST | Simple completion |
| `/ask/stream` | GET/POST | Streaming completion |
| `/supports` | GET | List supported sites/models |

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Language | TypeScript |
| Container | Docker |
| Image | `xiangsx/gpt4free-ts:latest` |

### Configuration

**Environment Variables (.env):**
```env
http_proxy=http://host:port
rapid_api_key=xxxxxxxxxx
EMAIL_TYPE=temp-email44
DEBUG=0
POOL_SIZE=0
PHIND_POOL_SIZE=0
```

| Variable | Purpose |
|----------|---------|
| `http_proxy` | Proxy for accessing blocked sites |
| `rapid_api_key` | For temp email services |
| `EMAIL_TYPE` | Temp email provider |
| `DEBUG` | Enable debug logging |
| `POOL_SIZE` | Forefront concurrency |
| `PHIND_POOL_SIZE` | Phind concurrency |

### Deployment

**Docker:**
```bash
docker run -p 3000:3000 --env-file .env xiangsx/gpt4free-ts:latest
```

**Docker Compose:**
```bash
docker-compose up --build -d
```

**Native:**
```bash
yarn
yarn start
```

### API Examples

**OpenAI-compatible:**
```bash
curl http://localhost:3000/v1/chat/completions?site=you \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello"}]}'
```

**Simple ask:**
```bash
curl "http://localhost:3000/ask?prompt=Hello&model=gpt-3.5-turbo&site=you"
```

**Streaming:**
```bash
curl "http://localhost:3000/ask/stream?prompt=Hello&site=you"
```

### Rate Limits & Constraints

- Each site has different rate limits
- Some sites may be offline (project tracks availability)
- Pool size controls concurrency per provider
- Proxy may be required for some regions

### CLI Integration Potential

**Very High** - Most flexible option:
- Multiple provider redundancy
- OpenAI-compatible API
- Simple query interface
- Streaming support
- Automatic failover potential

### Reliability & Maintenance

| Aspect | Status |
|--------|--------|
| Last Update | 2023-09-10 (models list) |
| Community | Active Discord |
| Stability | Variable (depends on sites) |
| License | GNU GPL |

### Legal Notice

This project is for educational purposes only. Users are responsible for complying with each site's Terms of Service.

---

## Comparative Analysis

### Feature Comparison Matrix

| Feature | FREEGLM | GLM-Free-API (xiaoY233) | qwen-free-api | glm-free-api | minimax-free-api | gpt4free-ts |
|---------|---------|-------------------------|---------------|--------------|------------------|-------------|
| OpenAI Compatible | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gemini Compatible | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Claude Compatible | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Streaming | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-turn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Image Generation | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Vision | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Document Analysis | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| TTS/STT | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Video Generation | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Multi-provider | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Security Issues | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ |

### Deployment Complexity

| Project | Docker | Native | Cloud |
|---------|--------|--------|-------|
| FREEGLM | ❌ | ✅ | ❌ |
| GLM-Free-API (xiaoY233) | ✅ | ✅ | ❌ |
| qwen-free-api | ✅ | ✅ | ✅ (Render/Vercel) |
| glm-free-api | ✅ | ✅ | ✅ (Render/Vercel) |
| minimax-free-api | ✅ | ✅ | ✅ (Render/Vercel) |
| gpt4free-ts | ✅ | ✅ | ❌ |

### Authentication Complexity

| Project | Auth Method | Complexity |
|---------|-------------|------------|
| FREEGLM | None | ⭐ Simple |
| GLM-Free-API (xiaoY233) | Cookie token | ⭐⭐ Moderate |
| qwen-free-api | Cookie token | ⭐⭐ Moderate |
| glm-free-api | Cookie token | ⭐⭐ Moderate |
| minimax-free-api | LocalStorage token | ⭐⭐ Moderate |
| gpt4free-ts | None/Proxy | ⭐⭐⭐ Variable |

---

## Integration Recommendations

### For CLI Tool Development

#### Recommended Primary Choice: **minimax-free-api**

**Reasons:**
1. Most comprehensive feature set (chat, TTS, STT, vision)
2. Active maintenance by LLM-Red-Team
3. OpenAI-compatible API
4. No known security issues
5. Good documentation

**Integration Example:**
```typescript
const response = await fetch('http://localhost:8000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.MINIMAX_TOKEN}`
  },
  body: JSON.stringify({
    model: 'hailuo',
    messages: [{ role: 'user', content: prompt }],
    stream: true
  })
});
```

#### Recommended Backup Choice: **qwen-free-api**

**Reasons:**
1. Stable OpenAI-compatible API
2. Active maintenance
3. Good streaming support
4. Image generation capability

#### Recommended Multi-Provider Choice: **gpt4free-ts**

**Reasons:**
1. Aggregates multiple providers
2. Automatic failover potential
3. Wide model selection
4. No authentication required for most providers

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Application                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  OpenAI SDK     │  │  Custom Client  │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           └──────────┬─────────┘                            │
│                      │                                      │
│              ┌───────▼───────┐                              │
│              │ Provider Router│                             │
│              └───────┬───────┘                              │
│                      │                                      │
│  ┌───────────────────┼───────────────────┐                 │
│  │                   │                   │                 │
│  ▼                   ▼                   ▼                 │
│ ┌────────┐     ┌────────┐     ┌────────┐                  │
│ │minimax │     │ qwen   │     │gpt4free│                  │
│ │-free   │     │-free   │     │  -ts   │                  │
│ └────────┘     └────────┘     └────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Template

```typescript
interface ProviderConfig {
  name: string;
  baseUrl: string;
  authToken?: string;
  models: string[];
  features: {
    chat: boolean;
    streaming: boolean;
    vision: boolean;
    imageGeneration: boolean;
    tts: boolean;
    stt: boolean;
  };
}

const providers: ProviderConfig[] = [
  {
    name: 'minimax',
    baseUrl: 'http://localhost:8000',
    authToken: process.env.MINIMAX_TOKEN,
    models: ['hailuo', 'MiniMax-Text-01'],
    features: {
      chat: true,
      streaming: true,
      vision: true,
      imageGeneration: false,
      tts: true,
      stt: true
    }
  },
  {
    name: 'qwen',
    baseUrl: 'http://localhost:8001',
    authToken: process.env.QWEN_TOKEN,
    models: ['qwen', 'qwen-plus', 'qwen-max'],
    features: {
      chat: true,
      streaming: true,
      vision: true,
      imageGeneration: true,
      tts: false,
      stt: false
    }
  },
  {
    name: 'gpt4free',
    baseUrl: 'http://localhost:3000',
    models: ['gpt-3.5-turbo', 'gpt-4'],
    features: {
      chat: true,
      streaming: true,
      vision: false,
      imageGeneration: true,
      tts: false,
      stt: false
    }
  }
];
```

### Security Considerations

1. **Token Storage**: Store authentication tokens securely (environment variables, secure vault)
2. **Data Privacy**: Be aware that messages are forwarded to third-party servers
3. **Rate Limiting**: Implement client-side rate limiting to avoid account bans
4. **Error Handling**: Handle API failures gracefully with fallback providers
5. **Legal Compliance**: Review and comply with each provider's Terms of Service

### Disclaimer

All projects analyzed in this document:
- Are **unofficial** third-party implementations
- Use **reverse-engineering** techniques that may violate Terms of Service
- Have **stability risks** due to upstream API changes
- Are intended for **educational and personal use only**
- Should **not** be used for production or commercial applications

For production use, consider official API providers:
- [Zhipu AI Open Platform](https://open.bigmodel.cn/)
- [Alibaba DashScope](https://dashscope.console.aliyun.com/)
- [MiniMax Platform](https://www.minimaxi.com/platform)
- [OpenAI API](https://platform.openai.com/)

---

## Related Projects

The LLM-Red-Team organization maintains several other free-api projects:

| Project | Provider | Status |
|---------|----------|--------|
| [kimi-free-api](https://github.com/LLM-Red-Team/kimi-free-api) | Moonshot AI (Kimi.ai) | Active |
| [step-free-api](https://github.com/LLM-Red-Team/step-free-api) | 阶跃星辰 (跃问) | Active |
| [metaso-free-api](https://github.com/LLM-Red-Team/metaso-free-api) | 秘塔AI (Metaso) | Active |
| [doubao-free-api](https://github.com/LLM-Red-Team/doubao-free-api) | 字节跳动 (豆包) | Active |
| [jimeng-free-api](https://github.com/LLM-Red-Team/jimeng-free-api) | 字节跳动 (即梦AI) | Active |
| [spark-free-api](https://github.com/LLM-Red-Team/spark-free-api) | 讯飞星火 | Active |
| [deepseek-free-api](https://github.com/LLM-Red-Team/deepseek-free-api) | 深度求索 | Active |
| [emohaa-free-api](https://github.com/LLM-Red-Team/emohaa-free-api) | 聆心智能 | Unavailable |

---

*Document generated from repository research on March 21, 2026*
