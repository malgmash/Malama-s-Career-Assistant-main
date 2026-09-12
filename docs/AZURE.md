# Azure

## Why Azure here

The ingestion worker is a scheduled job that fans out over HTTP calls and
writes blobs. That is the exact shape Azure Functions is built for, and the
consumption plan means it costs nothing when idle.

## Billing reality

Running on a standard Azure free account, not Azure for Students. Student
verification failed. That changes nothing architecturally and everything about
discipline.

What the free account actually is:

- $200 credit, usable in the first 30 days only
- A set of services free for 12 months, new customers only
- A larger set of services free always, within published monthly caps

**The 30 day decision.** At the end of 30 days, or when the credit runs out,
Azure asks whether to move to pay-as-you-go. If you do not, resources are
eventually disabled and deleted. If you do, resources keep running and the
free monthly allowances continue, but the spending limit is gone.

So we upgrade to pay-as-you-go before day 30, and then survive on always-free
allowances alone. There is no hard cap protecting us after that point. Budget
alerts notify, they do not block. The architecture is the control.

## Resource allowlist

If it is not on this list, it does not get created. Adding a row to this
table is a decision, not a shortcut.

| Purpose | Resource | Allowance | Config that keeps it free |
| --- | --- | --- | --- |
| Ingestion worker | Functions, consumption plan (Y1) | 1M executions and 400,000 GB-s per month, always free | Timer trigger, short runs. Never Premium, never Flex, never a dedicated plan |
| Frontend | Static Web Apps, Free tier | Always free | Free SKU only. Standard costs money |
| Raw payloads, resumes | Storage account, Blob, LRS, Hot | 5GB | One account, shared with the Functions runtime requirement |
| Resume parsing | AI Document Intelligence, F0 | 500 pages per month | F0 SKU only. S0 bills per page |
| Telemetry | Application Insights | 5GB ingest per month | Sampling at 20 percent and a daily cap |
| Secrets | Key Vault, Standard | Not free, roughly $0.03 per 10,000 operations | Cache secrets at cold start. A few hundred operations a month is a fraction of a cent |

Honest note: this is not literally zero. Functions requires a storage account
and Key Vault bills per operation. Realistic steady state is under ten cents
a month. If a bill ever exceeds one dollar, something is misconfigured and
the fix is to find it, not to absorb it.

## Never create

Anything with an hourly floor bills whether or not it is used.

- Virtual machines of any size
- App Service plans, including Basic and the B1 free-for-12-months tier
- Azure SQL Database, Cosmos DB, Azure Database for PostgreSQL
- Azure Cache for Redis
- Application Gateway, Front Door, NAT Gateway, Azure Bastion
- Static public IP addresses
- Log Analytics workspaces beyond the one behind Application Insights
- Azure AI Search, any paid tier
- Anything on a Premium or Standard SKU where a Free or F0 SKU exists

Postgres stays on Supabase. That is deliberate. Every managed database on
Azure has an hourly floor and would be the single largest line item.

## Guardrails to configure on day one

1. **Budget at $1 and $5**, defined in Bicep, with email alerts. Alerts do not
   stop spend. They exist so you find out in hours rather than at month end.
2. **Application Insights daily cap** at 0.15GB per day. Telemetry is the most
   common surprise line item on otherwise free projects.
3. **Blob lifecycle policy** moving raw payloads older than 90 days to Cool,
   and deleting them at 365 days.
4. **Function timeout** set explicitly. A runaway loop on consumption billing
   is the other way this goes wrong.
5. **One resource group**, so cleanup is a single delete.
6. **Weekly check** of the Cost card on the portal home page while building.
   Daily during the first week.

## Identity and secrets

Managed Identity for every service to service call. Function to Blob, Function
to Key Vault, Function to Document Intelligence. No connection strings in app
settings, no keys in source, no keys in CI.

Anthropic and Supabase credentials live in Key Vault and are read once at cold
start, then held in module scope. Reading per invocation multiplies Key Vault
operations for no benefit.

## Bicep layout

```
/infra
  main.bicep              subscription scope, resource group, budget
  modules/
    storage.bicep
    functions.bicep
    keyvault.bicep
    insights.bicep
    docintel.bicep
    staticwebapp.bicep
  params/
    dev.bicepparam
```

Everything deployable from zero with one command, and destroyable with one
resource group delete. If a resource exists only because it was clicked into
being in the portal, it does not count and it will be the thing that bills.

Every module pins its SKU explicitly. No defaults. A module that does not name
its SKU is a module that will silently deploy a paid tier.

## Local development

Functions run locally with Core Tools against Azurite for Blob. Document
Intelligence has no emulator, so local runs use a cached fixture response and
only hit the real service behind an explicit flag. This matters more than
usual here, since the F0 allowance is 500 pages a month and a test loop can
burn it in an afternoon.

## If the student offer ever comes through

Nothing needs to change. Credits apply to the same subscription and simply
absorb the cents. Do not loosen the allowlist because credits arrived. The
credit expires in 12 months and the architecture has to outlive it.
