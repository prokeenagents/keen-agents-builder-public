# MCP — what the builder can do itself

You act through an MCP account: its **role** decides which tools succeed (`403 Forbidden` otherwise), and every write
needs a session its owner confirmed with a 6-digit code (else `MFA required!`). Sign-in, every tool and its inputs:
`../../MCP/SKILL.md` and `../../MCP/tools.md`.

**Never ask the person to paste a secret into the chat.** Tell them the console path and let them type it there
(`secrets-and-credentials.md`). MCP sees secret NAMES only.

**Locks:** every update / assign / policy / enable / delete tool, plus `rotate_api_key` and `set_api_key_site`, needs
`lock_record { kind, id }` first and `unlock_record` after; creates need none (details: `record-locks.md`).

| Console segment | Through MCP | Tools | What the person does in the console instead |
|---|---|---|---|
| Organization › Accounts | no | — | Everything: create, role, block, reset password / MFA, delete (owner / admin) |
| Organization › My Account | no | — | Password, two-step sign-in |
| Organization › Roles | no | — | Everything (owner / admin) |
| Organization › MCP Accounts | no | — | Create, role, owner, enable, **Rotate secret**, delete, **Unblock** (owner / admin) |
| AI › Spaces | yes | `list_spaces` `get_space` `create_space` `update_space` `delete_space` `get_space_deployment_token` `reset_space_deployment_token` `clear_spaces_cache` | Import / export |
| AI › Agents | partly | `list_agents` `get_agent` `create_agent` `update_agent` `delete_agent` `get_agent_settings` `update_agent_settings` `get_agent_front_settings` `update_agent_front_settings` `list_agent_secrets` | Typing secret values (the agent's **Secrets** card); import / export |
| AI › Consumers | partly (read only) | `list_consumers` `get_consumer` `get_consumer_info` | Create, reset password, spaces, contract, delete |
| AI › MCP Consumers | yes | `list_mcp_consumers` `get_mcp_consumer` `create_mcp_consumer` `assign_mcp_consumer_contract` `assign_mcp_consumer_spaces` `set_mcp_consumer_enabled` `rotate_mcp_consumer_secret` `delete_mcp_consumer` `get_mcp_consumer_token` `refresh_mcp_consumer_token` | — (create and assign exist only through MCP) |
| API › Api Keys | partly | `list_api_keys` `get_api_key` `create_api_key` `update_api_key` `rotate_api_key` `wake_api_key` `delete_api_key` `set_api_key_enabled` `get_api_key_site` `set_api_key_site` `list_api_key_secrets` | **Start** after a Create / Rotate (held for a person); typing application secret values; import / export |
| API › Contracts | yes | `list_consumer_contracts` `get_consumer_contract` `list_contract_spaces` `create_consumer_contract` `update_consumer_contract` `delete_consumer_contract` `update_consumer_contract_policy` `assign_contract_spaces` `assign_contract_default_system_spaces` `assign_contract_default_outside_spaces` | Import / export |
| API › Webhooks | yes | `list_webhooks` `get_webhook` `create_webhook` `update_webhook` `delete_webhook` | Import / export |
| API › Clients | yes | `list_clients` `get_client` `create_client` `update_client` `rotate_client` `delete_client` | Import / export |
| API › Certificates | yes | `list_certificates` `get_certificate` `create_certificate` `update_certificate` `rotate_certificate` `delete_certificate` | — (certificates are never imported or exported) |
| System › Logs | yes | `list_log_settings` `update_log_setting` `get_log_audit` `get_log_file` | — |
| System › Log Records | yes | `list_log_records` `create_log_record` `update_log_record` `delete_log_record` `reveal_log_token` | — (log records are never imported or exported) |
| System › Cache | yes | `get_cache_status` `create_cache` `invalidate_cache` `rebuild_api_key_cache` | — |
| System › Debugger | no | — | Switch on / off, kill connections (owner / admin); the person attaches from VS Code |
| Import / Export (every page) | no | — | The section's **Import** / **Export** pages |
| Deploying a project | no tool | `get_space_deployment_token` for `keen-deploy` | — |

Session tools in every case: `mcp_login`, `mcp_login_verify`, `mcp_login_resend`, `logout`, `lock_record`, `unlock_record`
(88 tools in all).
