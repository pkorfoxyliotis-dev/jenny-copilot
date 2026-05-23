# Jenny Copilot

A Chrome/Brave browser extension that puts a powerful AI assistant in your side panel, supporting multiple LLM providers, project memory, session wrap-up, web search, page reading, voice input, and file attachments.

---

## Features

- Multi-provider AI: Venice, OpenAI, Anthropic Claude, Google Gemini, xAI Grok, Mistral, DeepSeek, and custom endpoints
- Project memory: create projects with persistent context and session history
- Session wrap-up: summarise each session into a compact context block, automatically injected into the next session
- Web search: live search via Tavily, Serper, Brave Search, or SerpAPI, injected into the AI prompt
- Read page: send the current page content directly to the AI
- Snapshot: capture interactive elements on any page
- Voice input: say "Jenny [your message]" to send hands-free
- File attachments: attach text files or images to your messages
- Image generation: Venice Flux models supported
- Markdown rendering: code blocks, links, and copy/download buttons

---

## Installation (Developer Mode)

1. Download this repository — click the green Code button then Download ZIP, then unzip it
2. Open Chrome or Brave and go to chrome://extensions
3. Enable Developer mode (toggle in the top right)
4. Click Load unpacked
5. Select the unzipped jenny-copilot folder
6. The Jenny icon will appear in your browser toolbar — click it to open the side panel

---

## Setup

1. Click the gear icon in the extension to open API Keys
2. Enter your API key for whichever provider(s) you want to use
3. Optionally set a search provider and key for live web search
4. Click Save

You need at least one API key to start chatting. Each user manages their own keys — no keys are included or shared.

---

## Supported Models

| Provider | Example Models |
|----------|----------------|
| Venice | Llama 3.3 70B, DeepSeek R1 671B, Venice Uncensored |
| OpenAI | GPT-4o, GPT-4o Mini, o3, o4 Mini |
| Anthropic | Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 3.5 |
| Google Gemini | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash |
| xAI Grok | Grok 3, Grok 3 Fast, Grok 3 Mini |
| Mistral | Mistral Large, Mistral Small, Codestral |
| DeepSeek | DeepSeek V4 Flash, DeepSeek V4 Pro |
| Venice Image | Flux 2 Max, Flux 2 Pro |
| Custom | Any OpenAI-compatible endpoint |

---

## Project Memory and Session Wrap-up

Jenny supports a project-based memory system. Create a project with a name and system context, then chat within it — messages are saved per project. At the end of a session click Wrap Up to generate a structured summary. The summary is saved to the project session log and becomes the system prompt for the next session. Up to the last 20 session summaries are kept in memory.

---

## Privacy

- All API keys are stored locally in chrome.storage.local — never sent anywhere except the AI provider you choose
- No data is collected, tracked, or shared
- The extension requires broad host permissions only to support the Read Page and Snapshot features on any website you use them on

---

## License

MIT — free to use, modify, and distribute.
