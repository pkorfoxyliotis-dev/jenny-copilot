# Privacy Policy for Jenny Copilot

**Last updated: May 2026**

Jenny Copilot is a Chrome/Brave browser extension. This privacy policy explains what data the extension accesses, how it is used, and what is never collected or shared.

---

## Data We Collect

Jenny Copilot does not collect, transmit, or store any personal data on external servers.

All data you enter — including API keys, project names, context notes, session messages, and wrap-up summaries — is stored exclusively in your browser's local storage (chrome.storage.local) on your own device. This data never leaves your device except as described below.

---

## API Keys

You may enter API keys for third-party AI providers (such as Anthropic, OpenAI, Google, Venice AI, xAI, Mistral, or DeepSeek). These keys are stored only in your browser's local storage and are sent directly from your browser to the respective provider's API when you send a message. They are never sent to any server controlled by Jenny Copilot or its developer.

---

## Messages and Conversations

When you send a message, it is transmitted directly from your browser to the AI provider API you have selected. Jenny Copilot does not intercept, log, or store your conversations on any external server.

Conversation history is saved locally in your browser as part of your project data, so you can continue sessions across browser restarts. You can delete this data at any time by deleting a project or clearing your browser's extension storage.

---

## Web Search

If you enable web search, your query is sent directly from your browser to the search provider you configured (Tavily, Serper, Brave Search, or SerpAPI) using your own API key. Jenny Copilot does not proxy or log these requests.

---

## Page Content

When you use the Read Page or Snapshot features, the content of the currently active browser tab is read locally and sent directly to your chosen AI provider as part of your message. This content is not sent to any other server.

---

## Permissions

Jenny Copilot requests the following permissions:

- storage: to save your API keys, projects, and session data locally in your browser
- sidePanel: to display the assistant in the Chrome side panel
- tabs: to read the URL and title of the active tab for the Read Page and Snapshot features
- scripting: to inject a content script that reads page content when you click Read Page or Snapshot
- host permissions (all URLs): required so the Read Page and Snapshot features work on any website you choose to use them on

No permission is used for tracking, advertising, or any purpose beyond the stated features.

---

## Third-Party Services

When you use Jenny Copilot, your messages and queries are sent to the AI or search provider APIs you have configured. Those providers have their own privacy policies which govern how they handle your data. Jenny Copilot has no control over and takes no responsibility for third-party providers' data practices.

---

## Children's Privacy

Jenny Copilot is not directed at children under 13. We do not knowingly collect any information from children.

---

## Changes to This Policy

If this policy is updated, the new version will be published at this URL with an updated date.

---

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/pkorfoxyliotis-dev/jenny-copilot/issues
