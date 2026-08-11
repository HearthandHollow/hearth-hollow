# Hearth LLM on cortex — Claude-Code-class agent harness

Goal: give the custom **Hearth LLM** (served from the cortex AI stack) the same
*capabilities* Claude / Claude Code has — an agentic harness with shell, file,
git, and web tools, plus connector access (GitHub, Google, Zapier, the homelab
Docker hosts) — using Hearth LLM's own credentials.

> **Move me:** this doc belongs in the private `homestead-automation` repo on
> Gitea. It lives here only because it was authored from a cloud session that
> cannot reach the LAN. No secrets in this folder — placeholders only.

---

## The one-line architecture

```
Ollama (existing, cortex) ──> LiteLLM proxy (Anthropic /v1/messages format)
                                        │
                              Claude Code CLI  (ANTHROPIC_BASE_URL=http://litellm)
                              = the full Claude Code harness (Bash, file tools,
                                subagents, skills, hooks, MCP client)
                                        │
                              MCP servers = the "connectors"
                              (GitHub, Google Workspace, Zapier, Obsidian, search)
```

Key insight: **Claude Code's harness is model-agnostic via `ANTHROPIC_BASE_URL`.**
LiteLLM (already part of the cortex stack) can speak the Anthropic
`/v1/messages` format and route to any Ollama model. Point the Claude Code CLI
at LiteLLM and Hearth LLM inherits the *entire* toolset — terminal, file edit,
glob/grep, git, subagents, MCP, skills — with zero harness code to write.
LiteLLM's docs have a dedicated "Claude Code" tutorial for exactly this setup.

Reality check: the harness is the easy half. Tool-use quality depends on the
underlying model. A small local model will drive these tools far less reliably
than Claude — expect to iterate on the base model choice (pick the strongest
tool-calling model that fits cortex's VRAM; keep the Hearth persona as a system
prompt / Ollama Modelfile on top of it rather than baked into a weaker base).

---

## Deploy (run on cortex, from a machine on the LAN / Tailscale)

1. **Stack dir** (mirrors the forge convention): `/opt/stacks/hearth-agent/`
   with `docker-compose.yml` + `litellm-config.yaml` from this folder.
   Set a `LITELLM_MASTER_KEY` (any random string) in an `.env` file.

2. **Bring up LiteLLM**: `docker compose up -d`, then verify:

   ```sh
   curl -s http://localhost:4000/v1/messages \
     -H "x-api-key: $LITELLM_MASTER_KEY" -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"hearth-llm","max_tokens":64,"messages":[{"role":"user","content":"hello"}]}'
   ```

3. **Install the harness** on cortex (or any LAN box): `npm i -g @anthropic-ai/claude-code`,
   then source `hearth-agent.env.example` values:

   ```sh
   export ANTHROPIC_BASE_URL=http://localhost:4000
   export ANTHROPIC_AUTH_TOKEN=$LITELLM_MASTER_KEY
   export ANTHROPIC_MODEL=hearth-llm
   export ANTHROPIC_SMALL_FAST_MODEL=hearth-llm
   claude
   ```

4. **Connectors**: copy `mcp.json.example` to the working project as `.mcp.json`
   and fill in credentials (see table below). MCP servers give Hearth LLM the
   connector surface; Claude Code's built-ins give it the local tools.

5. **Homelab "full access"**: don't build a Docker MCP — give the harness what
   Claude Code actually uses: **SSH**. Mint a dedicated keypair for the agent
   (`ssh-keygen -t ed25519 -C hearth-agent`), install the pubkey on forge,
   hollow, and hearth, and the Bash tool can now run `ssh forge docker ps`,
   compose rebuilds, etc. Prefer per-host `authorized_keys` restrictions over a
   blanket root key (see Security).

Alternative harnesses if Claude Code + local model proves too brittle:
**Goose** (Block; MCP-native, any OpenAI-compatible endpoint), **OpenHands**
(containerized dev agent), or **Open WebUI + mcpo** for a chat-first UI. All
speak to the same LiteLLM endpoint.

---

## Connector parity map (cloud Claude → Hearth LLM equivalent)

| Cloud connector | Hearth LLM equivalent | Credential it needs |
|---|---|---|
| GitHub MCP | `github-mcp-server` (official, runs as docker) | Fine-grained PAT, scoped to the HearthandHollow repos |
| Homelab / dockers | Claude Code Bash tool + dedicated SSH key to forge/hollow/hearth | `hearth-agent` ed25519 key |
| Gmail / Calendar / Drive | Google Workspace MCP server (community `workspace-mcp` or similar) | Own OAuth client + refresh token. The existing business Gmail OAuth client can be reused if re-minted with the extra scopes — remember the CLAUDE.md rule: re-mint with **all** scopes at once |
| Zapier (9000+ apps) | **Your own Zapier MCP endpoint** — mcp.zapier.com generates a per-account MCP URL any client can use. This is the one connector that transfers almost 1:1 | Zapier account MCP URL |
| Obsidian vault | Filesystem access to the vault on the NAS (it's just markdown), or `mcp-obsidian` against the Local REST API plugin | none / REST API key |
| Web search & fetch | Self-host SearXNG on forge + a fetch/search MCP, or Brave Search MCP | none / Brave API key |
| Stripe, Vercel, etc. | Each vendor's public MCP server | Own API keys |

What does **not** transfer: the Anthropic-hosted connectors themselves
(claude.ai Gmail/Drive/Calendar). Those OAuth grants live inside Anthropic's
infrastructure and cannot be exported to another model — each service above
needs its own credential, stored in Infisical, injected as env vars.

---

## Security — read before granting "full access"

- **A local model is much more prompt-injectable than Claude.** Every web page,
  email, and GitHub issue Hearth LLM reads is untrusted input, and it will have
  root-equivalent reach (SSH + docker = root). Mitigate: run the harness in
  Claude Code's default permission mode (approval prompts) rather than
  `bypassPermissions`; only relax per-tool once trust is earned.
- **Scope the credentials**: fine-grained GitHub PAT (not classic, not org-wide
  admin); SSH `authorized_keys` with `command=`/`from=` restrictions where
  possible; a Zapier MCP URL exposes every connected Zap action, so connect
  only what the agent should touch.
- **Secrets live in Infisical**, never in compose files, Modelfiles, or this
  repo. `.env` files on cortex should be chmod 600 like forge's.
- **Log it**: keep the agent's shell history / session transcripts on the NAS
  so there's an audit trail of what it ran.

## Why this wasn't done directly from the cloud session

The cloud sandbox has no route to 192.168.x (Tailscale-only), and the vault
bridge was down (502) during authoring. Run the deploy steps from a **local
Cowork/Desktop session** on the laptop — it has Tailscale + the SSH key and can
do the whole thing, including verifying end-to-end.
