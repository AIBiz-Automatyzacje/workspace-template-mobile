# Coolify CLI Commands Reference

Version: 1.4.0

## Table of Contents

1. [Global Flags](#global-flags)
2. [Context Management](#context-management)
3. [Applications](#applications)
4. [Application Environment Variables](#application-environment-variables)
5. [Application Deployments](#application-deployments)
6. [Services](#services)
7. [Service Environment Variables](#service-environment-variables)
8. [Databases](#databases)
9. [Database Backups](#database-backups)
10. [Deploy Commands](#deploy-commands)
11. [Servers](#servers)
12. [Projects](#projects)
13. [Teams](#teams)
14. [GitHub Integrations](#github-integrations)
15. [Private Keys](#private-keys)
16. [Resources](#resources)
17. [Configuration & Updates](#configuration--updates)

---

## Global Flags

Available with all commands:

| Flag | Description |
|------|-------------|
| `--context <name>` | Use specific context by name |
| `--format <type>` | Output format: `table` (default), `json`, `pretty` |
| `--debug` | Enable verbose logging |
| `-s, --show-sensitive` | Show sensitive information (passwords, tokens, IPs) |
| `--token <string>` | Override context token for this command |

---

## Context Management

Manage connections to Coolify instances. Aliases: none.

### Add Context
```bash
coolify context add <name> <url> <token>
# Flags: -d/--default (set as default), -f/--force (overwrite existing)
```

### List / Get / Use
```bash
coolify context list
coolify context get <name>
coolify context use <name>           # Switch default context
coolify context set-default <name>   # Same as 'use'
```

### Update / Set Token
```bash
coolify context update <name> --name <new> --url <new> --token <new>
coolify context set-token <name> <token>
```

### Verify / Version / Delete
```bash
coolify context verify      # Test connection and auth
coolify context version     # Get Coolify server version
coolify context delete <name>
```

---

## Applications

Aliases: `app`, `apps`, `application`, `applications`

### List / Get
```bash
coolify app list
coolify app get <uuid>
```

### Create Application

5 source types: `public`, `github`, `deploy-key`, `dockerfile`, `dockerimage`

**Common required flags**: `--server-uuid`, `--project-uuid`, `--environment-name` (or `--environment-uuid`)

```bash
# From public git repo
coolify app create public \
  --server-uuid <uuid> --project-uuid <uuid> --environment-name production \
  --git-repository "https://github.com/user/repo" --git-branch main \
  --build-pack nixpacks --ports-exposes 3000

# From GitHub App (private repo)
coolify app create github \
  --server-uuid <uuid> --project-uuid <uuid> --environment-name production \
  --github-app-uuid <uuid> --git-repository "owner/repo" --git-branch main \
  --build-pack nixpacks --ports-exposes 3000

# From SSH deploy key (private repo)
coolify app create deploy-key \
  --server-uuid <uuid> --project-uuid <uuid> --environment-name production \
  --private-key-uuid <uuid> --git-repository "git@github.com:owner/repo.git" \
  --git-branch main --build-pack nixpacks --ports-exposes 3000

# From Dockerfile content
coolify app create dockerfile \
  --server-uuid <uuid> --project-uuid <uuid> --environment-name production \
  --dockerfile "$(cat Dockerfile)" --ports-exposes 3000

# From Docker image
coolify app create dockerimage \
  --server-uuid <uuid> --project-uuid <uuid> --environment-name production \
  --docker-registry-image-name "nginx:latest" --ports-exposes 80
```

**Optional flags** (for git-based sources): `--name`, `--description`, `--domains`, `--base-directory`, `--build-command`, `--install-command`, `--start-command`, `--publish-directory`, `--git-commit-sha`, `--health-check-enabled`, `--health-check-path`, `--limits-cpus`, `--limits-memory`, `--ports-mappings`, `--destination-uuid`, `--instant-deploy`

**Build packs**: `nixpacks`, `static`, `dockerfile`, `dockercompose`

### Update Application
```bash
coolify app update <uuid> --name "New Name" --domains "app.example.com" --git-branch develop
```
Updateable fields: `--name`, `--description`, `--domains`, `--git-branch`, `--git-repository`, `--base-directory`, `--build-command`, `--install-command`, `--start-command`, `--publish-directory`, `--dockerfile`, `--docker-image`, `--docker-tag`, `--ports-exposes`, `--ports-mappings`, `--health-check-enabled`, `--health-check-path`

### Lifecycle Control
```bash
coolify app start <uuid>     # Aliases: start, deploy. Flags: --force, --instant-deploy
coolify app stop <uuid>
coolify app restart <uuid>
coolify app delete <uuid>    # Flag: -f/--force (skip confirmation)
```

### Application Logs
```bash
coolify app logs <uuid>
coolify app logs <uuid> --lines 500    # Default: 100
coolify app logs <uuid> --follow       # Stream logs (like tail -f)
```

---

## Application Environment Variables

Aliases: `env`, `envs`, `environment`

### List / Get
```bash
coolify app env list <app-uuid>
coolify app env list <app-uuid> --preview   # Show preview env vars
coolify app env list <app-uuid> --all       # Show all (regular + preview)
coolify app env get <app-uuid> <env-uuid-or-key>
```

### Create / Update / Delete
```bash
coolify app env create <app-uuid> --key DATABASE_URL --value "postgres://..."
# Flags: --build-time (default true), --runtime (default true),
#         --is-literal, --is-multiline, --preview

coolify app env update <app-uuid> <env-uuid> --value "new-value"
# Same flags as create plus --key for renaming

coolify app env delete <app-uuid> <env-uuid>   # Flag: --force
```

### Sync from .env File
```bash
coolify app env sync <app-uuid> --file .env.production
# Intelligently creates new vars and updates existing ones
# Flags: --build-time, --runtime, --is-literal, --preview
```

---

## Application Deployments

Per-application deployment history and logs.

```bash
coolify app deployments list <app-uuid>
coolify app deployments logs <app-uuid>                      # Latest deployment
coolify app deployments logs <app-uuid> <deployment-uuid>    # Specific deployment
# Flags: --follow (-f), --lines (-n), --debuglogs
```

---

## Services

One-click services (WordPress, Redis, Ghost, etc.). Aliases: `service`, `services`, `svc`

### List / Get
```bash
coolify service list
coolify service get <uuid>
```

### Create Service
```bash
# List available types
coolify service create --list-types

# Create with flags
coolify service create <type> \
  --server-uuid <uuid> --project-uuid <uuid> \
  --environment-name production --name "My Service" --instant-deploy
```

**Popular types**: `wordpress-with-mysql`, `wordpress-with-mariadb`, `wordpress-without-database`, `ghost`, `plausible`, `umami`, `uptime-kuma`, `n8n`, `n8n-with-postgresql`, `nextcloud`, `gitea`, `minio`, `grafana`, `metabase`, `nocodb`, `supabase`, `pocketbase`, `appwrite`

**Optional flags**: `--name`, `--description`, `--destination-uuid`, `--docker-compose`, `--instant-deploy`, `--environment-uuid`

### Lifecycle Control
```bash
coolify service start <uuid>
coolify service stop <uuid>
coolify service restart <uuid>
coolify service delete <uuid>
# Delete flags: -f/--force, --delete-configurations (default true),
#   --delete-volumes (default true), --delete-connected-networks (default true),
#   --docker-cleanup (default true)
```

---

## Service Environment Variables

Same structure as app env vars.

```bash
coolify service env list <service-uuid>
coolify service env get <service-uuid> <env-uuid-or-key>
coolify service env create <service-uuid> --key K --value V
coolify service env update <service-uuid> <env-uuid> --value "new"
coolify service env delete <service-uuid> <env-uuid>   # Flag: --force
coolify service env sync <service-uuid> --file .env
# Flags: --build-time, --runtime, --is-literal, --is-multiline
```

---

## Databases

Aliases: `database`, `databases`, `db`, `dbs`

Supported types: `postgresql`, `mysql`, `mariadb`, `mongodb`, `redis`, `keydb`, `clickhouse`, `dragonfly`

### List / Get
```bash
coolify database list
coolify database get <uuid>
```

### Create Database
```bash
coolify database create <type> --server-uuid <uuid> --project-uuid <uuid> \
  --environment-name production --name "My DB" --instant-deploy
```

**Type-specific flags**:
- PostgreSQL: `--postgres-db`, `--postgres-user`, `--postgres-password`
- MySQL: `--mysql-database`, `--mysql-user`, `--mysql-password`, `--mysql-root-password`
- MariaDB: `--mariadb-database`, `--mariadb-user`, `--mariadb-password`, `--mariadb-root-password`
- MongoDB: `--mongo-database`, `--mongo-root-username`, `--mongo-root-password`
- Redis: `--redis-password`
- KeyDB: `--keydb-password`
- Clickhouse: `--clickhouse-admin-user`, `--clickhouse-admin-password`
- Dragonfly: `--dragonfly-password`

**Common optional flags**: `--name`, `--description`, `--image`, `--is-public`, `--public-port`, `--limits-cpus`, `--limits-memory`, `--destination-uuid`

### Update Database
```bash
coolify database update <uuid> --name "New Name" --limits-memory "2g"
# Fields: --name, --description, --image, --is-public, --public-port,
#          --limits-cpus, --limits-memory
```

### Lifecycle Control
```bash
coolify database start <uuid>
coolify database stop <uuid>
coolify database restart <uuid>
coolify database delete <uuid>
# Delete flags: --delete-configurations (default true), --delete-volumes (default true),
#   --delete-connected-networks (default true), --docker-cleanup (default true)
```

---

## Database Backups

Full backup management with scheduling, retention, and S3 support.

### List / View
```bash
coolify database backup list <db-uuid>
coolify database backup executions <db-uuid> <backup-uuid>
```

### Create Scheduled Backup
```bash
coolify database backup create <db-uuid> \
  --frequency "0 0 * * *" --enabled \
  --save-s3 --s3-storage-uuid <uuid> \
  --retention-amount-s3 30 --retention-days-s3 90
```

**Flags**: `--frequency` (cron expr), `--enabled`, `--databases-to-backup`, `--dump-all`, `--save-s3`, `--s3-storage-uuid`, `--disable-local-backup`, `--retention-amount-locally`, `--retention-amount-s3`, `--retention-days-locally`, `--retention-days-s3`, `--retention-max-storage-locally`, `--retention-max-storage-s3`, `--timeout`

### Trigger / Update / Delete
```bash
coolify database backup trigger <db-uuid> <backup-uuid>
coolify database backup update <db-uuid> <backup-uuid> --frequency "0 */6 * * *"
coolify database backup delete <db-uuid> <backup-uuid>   # Flag: --delete-s3
coolify database backup delete-execution <db-uuid> <backup-uuid> <exec-uuid>  # Flag: --delete-s3
```

---

## Deploy Commands

Multiple ways to deploy resources.

```bash
# Deploy by UUID
coolify deploy uuid <uuid>           # Flag: --force

# Deploy by resource name
coolify deploy name <resource-name>  # Flag: --force

# Deploy multiple at once
coolify deploy batch <name1,name2,...>  # Flag: --force

# Cancel in-progress deployment
coolify deploy cancel <deploy-uuid>  # Flag: -f/--force

# List running deployments
coolify deploy list

# Get deployment details
coolify deploy get <deploy-uuid>
```

---

## Servers

Aliases: `server`, `servers`

```bash
coolify server list
coolify server get <uuid>              # Flag: --resources (include resources)
coolify server add <name> <ip> <key-uuid>  # Flags: -p/--port (default 22), -u/--user (default root), --validate
coolify server validate <uuid>
coolify server domains <uuid>          # Alias: domain
coolify server remove <uuid>
```

---

## Projects

Aliases: `project`, `projects`

```bash
coolify project list
coolify project get <uuid>
coolify project create --name "My Project" --description "..."
```

---

## Teams

Aliases: `teams`, `team`

```bash
coolify teams list
coolify teams get <team-id>
coolify teams current                        # Current authenticated team
coolify teams members list [team-id]         # Optional team-id, defaults to current
```

Members alias: `member`

---

## GitHub Integrations

Aliases: `github`, `gh`, `github-app`, `github-apps`

```bash
coolify github list
coolify github get <app-uuid>
coolify github repos <app-uuid>
coolify github branches <app-uuid> <owner/repo>
coolify github delete <app-uuid>   # Flag: -f/--force
```

### Create GitHub App
```bash
coolify github create \
  --name "My App" --api-url "https://api.github.com" --html-url "https://github.com" \
  --app-id 123456 --installation-id 789012 \
  --client-id "Iv1.abc" --client-secret "secret" \
  --private-key-uuid <uuid>
# Optional: --organization, --custom-port, --custom-user, --webhook-secret, --system-wide
```

### Update GitHub App
```bash
coolify github update <app-uuid> --name "New Name" --webhook-secret "new-secret"
# Same flags as create (all optional for update)
```

---

## Private Keys

Aliases: `private-key`, `private-keys`, `key`, `keys`

```bash
coolify private-key list
coolify private-key add <name> <key-or-file-path>
coolify private-key remove <uuid>
```

---

## Resources

Aliases: `resource`, `resources`

```bash
coolify resource list           # All resources (apps, services, databases) with UUID, name, type, status
coolify resource list --format json | jq '.[] | select(.status | contains("unhealthy"))'
```

---

## Configuration & Updates

```bash
coolify config      # Show config file location (~/.config/coolify/config.json)
coolify version     # Current CLI version
coolify update      # Check for and install updates
```

---

## Output Formats

```bash
coolify resource list                  # Table (default, human-readable)
coolify resource list --format json    # JSON (machine-readable, pipe to jq)
coolify resource list --format pretty  # Pretty JSON (indented)
```

## Tips

1. **Filter with jq**: `coolify resource list --format json | jq '.[] | select(.status=="running")'`
2. **Show secrets**: `coolify server list -s` (shows IPs, passwords)
3. **Skip confirmations**: `coolify app delete <uuid> --force`
4. **Override token**: `coolify --token <token> resource list` (useful for scripts)
5. **Debug mode**: `coolify --debug context verify`
6. **Switch contexts**: `coolify --context staging deploy uuid <uuid>` (one-off context switch)
