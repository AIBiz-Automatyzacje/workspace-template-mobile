---
name: coolify-manager
description: Manage and troubleshoot Coolify deployments using the official CLI (v1.4.0) and API. Use this skill when the user needs help with Coolify server management, WordPress troubleshooting on Coolify, debugging service issues, checking SSL certificates, accessing containers, managing applications and databases, deploying code, creating services or databases, managing environment variables, configuring backups with S3 and retention policies, or performing any deployment operations through Coolify. Also use when the user mentions docker containers on Coolify, deploy failures, self-hosted infrastructure management, or needs to batch-deploy multiple resources at once. Particularly useful for diagnosing down services, fixing .htaccess issues, REST API problems, and managing one-click services like WordPress, Ghost, n8n, Supabase, Uptime Kuma.
---

# Coolify Manager

Skill for managing Coolify deployments through CLI (v1.4.0) and direct API access. Covers diagnosing issues, fixing WordPress problems, managing containers, creating resources, and performing deployments.

## Prerequisites

1. Coolify instance access (self-hosted or cloud)
2. API token from Coolify dashboard at `/security/api-tokens`
3. Coolify CLI installed (see `scripts/install_coolify_cli.sh`)

## Setup

```bash
# Install CLI
bash scripts/install_coolify_cli.sh

# Add context
coolify context add <name> <url> <token>

# Verify connection
coolify context verify

# Quick health check
bash scripts/check_health.sh
```

For full CLI reference including all flags and subcommands, load `references/cli_commands.md`.

## Diagnosing Issues — Decision Tree

When a user reports a problem, follow this tree:

### 1. Service Availability

```
Site is down?
├── Check status: coolify resource list
├── Get details: coolify service get <uuid>
├── Check logs:  coolify app logs <uuid> --follow
│   └── Logs point to config issue? → Check env vars, restart
│   └── Logs point to crash? → Check app code, memory limits
└── Restart:     coolify service restart <uuid>
```

### 2. WordPress-Specific

```
WordPress issue?
├── 500 error after .htaccess change → Load references/wordpress_fixes.md
├── REST API warnings in Site Health → Likely false positive, test with curl
├── PHP limits (upload, memory, etc.) → Fix via .htaccess php_value directives
├── SSL certificate issues → Check with openssl, regenerate in dashboard
└── Access container: Coolify dashboard → Terminal → select "wordpress" container
```

For detailed WordPress troubleshooting steps, load `references/wordpress_fixes.md`.

### 3. Deployment Issues

```
Deploy failed?
├── Check deployments: coolify app deployments list <app-uuid>
├── Get deploy logs:   coolify app deployments logs <app-uuid> --follow
├── Cancel stuck deploy: coolify deploy cancel <deploy-uuid>
├── Fix issue (env vars, config, code)
└── Redeploy: coolify deploy uuid <app-uuid>
    Or by name: coolify deploy name <resource-name>
    Or batch:   coolify deploy batch <name1,name2,...>
```

### 4. Configuration/Environment

```
Need config changes?
├── App env vars:     coolify app env list <uuid>
│   ├── Create:       coolify app env create <uuid> --key K --value V
│   ├── Sync .env:    coolify app env sync <uuid> --file .env.production
│   └── Delete:       coolify app env delete <uuid> <env-uuid>
├── Service env vars: coolify service env list <uuid>
│   └── Same subcommands: create, get, update, delete, sync
└── After changes:    coolify app restart <uuid>
```

## Creating Resources

### Applications

5 source types available:

```bash
# From public repo
coolify app create public --server-uuid <uuid> --project-uuid <uuid> \
  --environment-name production --git-repository "https://github.com/user/repo" \
  --git-branch main --build-pack nixpacks --ports-exposes 3000

# From Docker image
coolify app create dockerimage --server-uuid <uuid> --project-uuid <uuid> \
  --environment-name production --docker-registry-image-name "nginx:latest" \
  --ports-exposes 80 --instant-deploy
```

Other source types: `github`, `deploy-key`, `dockerfile`. See `references/cli_commands.md` for full flags.

### One-Click Services

```bash
# List available service types
coolify service create --list-types

# Create WordPress
coolify service create wordpress-with-mysql \
  --server-uuid <uuid> --project-uuid <uuid> \
  --environment-name production --instant-deploy
```

Popular types: wordpress-with-mysql, ghost, n8n, supabase, pocketbase, uptime-kuma, grafana, nextcloud, gitea, minio, metabase.

### Databases

Supported: postgresql, mysql, mariadb, mongodb, redis, keydb, clickhouse, dragonfly.

```bash
coolify database create postgresql --server-uuid <uuid> --project-uuid <uuid> \
  --environment-name production --postgres-db mydb --postgres-user admin \
  --postgres-password secret --instant-deploy
```

## Backup Management

Database backups support scheduled cron jobs, local and S3 retention policies:

```bash
# Create scheduled backup (daily at midnight)
coolify database backup create <db-uuid> --frequency "0 0 * * *" --enabled \
  --save-s3 --s3-storage-uuid <s3-uuid> --retention-amount-s3 30

# Trigger immediate backup
coolify database backup trigger <db-uuid> <backup-uuid>

# List backup executions
coolify database backup executions <db-uuid> <backup-uuid>
```

## Key Concepts

- **Resource types**: application, service (one-click), database
- **UUIDs**: every resource has a unique UUID — use `coolify resource list` to find them
- **Contexts**: named connections to Coolify instances (url + token). Switch with `coolify context use <name>`
- **Build packs**: nixpacks, static, dockerfile, dockercompose
- **Deploy methods**: by UUID, by name, or batch (multiple at once)

## CLI Quick Reference

| Action | Command |
|--------|---------|
| List all resources | `coolify resource list` |
| App logs (streaming) | `coolify app logs <uuid> --follow` |
| Deploy by name | `coolify deploy name <name>` |
| Deploy multiple | `coolify deploy batch <n1,n2,...>` |
| Cancel deploy | `coolify deploy cancel <uuid>` |
| Sync env from file | `coolify app env sync <uuid> --file .env` |
| Create service | `coolify service create <type> --server-uuid ... --project-uuid ...` |
| Create database | `coolify database create <type> --server-uuid ... --project-uuid ...` |
| Backup database | `coolify database backup trigger <db-uuid> <backup-uuid>` |
| Server info | `coolify server get <uuid> --resources` |

For the complete CLI reference with all commands, flags, and examples, load `references/cli_commands.md`.

## References

- **`references/cli_commands.md`** — Complete CLI v1.4.0 command reference with all flags, aliases, and examples. Load when the user needs specific command syntax.
- **`references/api_endpoints.md`** — REST API endpoints for direct HTTP calls. Load when CLI doesn't support an operation or the user prefers API access.
- **`references/wordpress_fixes.md`** — WordPress-specific troubleshooting (.htaccess, PHP config, REST API, SSL). Load for any WordPress issue on Coolify.
