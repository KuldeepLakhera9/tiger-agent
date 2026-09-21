# TigerGraph MCP connection

This configuration is based on the supplied `tigergraph-mcp` source. It requires Python 3.10–3.14 and TigerGraph 4.1+ (4.2+ is preferable for TigerVector). It uses the documented stdio mode, which is the appropriate single-developer setup for this project.

## Install from the supplied checkout

From PowerShell, after creating a virtual environment if desired:

```powershell
python -m pip install -e C:\Users\rania\Downloads\tigergraph-mcp-main\tigergraph-mcp-main
```

Copy `mcp.env.example` to a private `.env`, complete the host and token, then test the connection through the MCP client. Do not commit the resulting `.env` or paste its token into case files.

## Generic stdio client entry

The exact surrounding configuration format depends on the MCP client, but the server process should be equivalent to:

```json
{
  "command": "tigergraph-mcp",
  "args": ["--env-file", "C:\\absolute\\path\\to\\.env"]
}
```

Start with a read-only smoke test: `tigergraph__list_graphs`, then `tigergraph__get_graph_schema`. After the schema is reviewed, use `tigergraph__gsql` to create the schema and `tigergraph__create_loading_job` / `tigergraph__run_loading_job_with_file` to load the prepared inputs. Install and call the five investigation queries with `tigergraph__install_query` and `tigergraph__run_installed_query`.

For the agent, restrict normal operation to schema inspection, installed-query execution, and controlled case-memory writes. Keep raw GSQL/schema and loading operations in an onboarding or administrator path; they can change the database materially.
