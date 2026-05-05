# Coolify API Endpoints Reference

Base URL: `https://your-coolify-instance.com/api/v1`

All endpoints require bearer token authentication:
```bash
-H "Authorization: Bearer YOUR_API_TOKEN"
```

## Table of Contents

1. [Resources](#resources)
2. [Applications](#applications)
3. [Application Environment Variables](#application-environment-variables)
4. [Services](#services)
5. [Service Environment Variables](#service-environment-variables)
6. [Databases](#databases)
7. [Database Backups](#database-backups)
8. [Deployments](#deployments)
9. [Servers](#servers)
10. [Projects](#projects)
11. [Teams](#teams)
12. [Private Keys](#private-keys)

---

## Resources

### List All Resources
```
GET /resources
```
Returns all resources (applications, services, databases) with UUIDs, names, types, and status.

---

## Applications

### CRUD
```
GET    /applications                    # List all
GET    /applications/{uuid}             # Get details
POST   /applications                    # Create (see CLI for easier creation)
PATCH  /applications/{uuid}             # Update configuration
DELETE /applications/{uuid}             # Delete
```

### Lifecycle
```
POST /applications/{uuid}/start
POST /applications/{uuid}/stop
POST /applications/{uuid}/restart
```

### Logs
```
GET /applications/{uuid}/logs?lines=200
```
Query parameters: `lines` (default: 100)

---

## Application Environment Variables

```
GET    /applications/{uuid}/envs                 # List all env vars
POST   /applications/{uuid}/envs                 # Create env var
PATCH  /applications/{uuid}/envs                 # Update env var (bulk)
PATCH  /applications/{uuid}/envs/{env_uuid}      # Update specific env var
DELETE /applications/{uuid}/envs/{env_uuid}      # Delete env var
```

---

## Services

### CRUD
```
GET    /services                        # List all
GET    /services/{uuid}                 # Get details (includes docker-compose, apps, DBs)
POST   /services                        # Create one-click service
DELETE /services/{uuid}                 # Delete
```

### Lifecycle
```
POST /services/{uuid}/start
POST /services/{uuid}/stop
POST /services/{uuid}/restart
```

---

## Service Environment Variables

```
GET    /services/{uuid}/envs
POST   /services/{uuid}/envs
PATCH  /services/{uuid}/envs/{env_uuid}
DELETE /services/{uuid}/envs/{env_uuid}
```

---

## Databases

### CRUD
```
GET    /databases                        # List all
GET    /databases/{uuid}                 # Get details
POST   /databases                        # Create
PATCH  /databases/{uuid}                 # Update
DELETE /databases/{uuid}                 # Delete
```

### Lifecycle
```
POST /databases/{uuid}/start
POST /databases/{uuid}/stop
POST /databases/{uuid}/restart
```

---

## Database Backups

```
GET    /databases/{uuid}/backups                              # List backup configs
POST   /databases/{uuid}/backups                              # Create backup config
GET    /databases/{uuid}/backups/{backup_uuid}                # Get backup config
PATCH  /databases/{uuid}/backups/{backup_uuid}                # Update backup config
DELETE /databases/{uuid}/backups/{backup_uuid}                # Delete backup config
GET    /databases/{uuid}/backups/{backup_uuid}/executions     # List executions
POST   /databases/{uuid}/backups/{backup_uuid}/trigger        # Trigger immediate backup
DELETE /databases/{uuid}/backups/{backup_uuid}/executions/{exec_uuid}  # Delete execution
```

---

## Deployments

### Deploy
```
POST /deploy
```
Request body:
```json
{"uuid": "resource-uuid"}
```

### Status
```
GET /deployments              # List all running
GET /deployments/{uuid}       # Get deployment details
```

---

## Servers

```
GET    /servers                         # List all
GET    /servers/{uuid}                  # Get details
POST   /servers                         # Add server
POST   /servers/{uuid}/validate         # Validate connection
GET    /servers/{uuid}/domains          # Get server domains
DELETE /servers/{uuid}                  # Remove server
```

---

## Projects

```
GET    /projects                        # List all
GET    /projects/{uuid}                 # Get details
POST   /projects                        # Create project
```

---

## Teams

```
GET /teams                              # List all teams
GET /teams/{id}                         # Get team details
GET /teams/{id}/members                 # List team members
GET /teams/current                      # Current authenticated team
GET /teams/current/members              # Current team members
```

---

## Private Keys

```
GET    /security/keys                   # List all
GET    /security/keys/{uuid}            # Get key details
POST   /security/keys                   # Add key
DELETE /security/keys/{uuid}            # Remove key
```

---

## Common Response Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `401` | Unauthorized (check API token) |
| `404` | Resource not found |
| `422` | Validation error |
| `429` | Rate limited |
| `500` | Server error |

## Rate Limiting

Check response headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Example: Filtering with jq

```bash
# Get all unhealthy services
curl -s -H "Authorization: Bearer $TOKEN" \
  https://instance.com/api/v1/resources \
  | jq '.[] | select(.status | contains("unhealthy"))'

# Get service apps and their status
curl -s -H "Authorization: Bearer $TOKEN" \
  https://instance.com/api/v1/services/SERVICE_UUID \
  | jq '.applications[] | {name, status}'
```
