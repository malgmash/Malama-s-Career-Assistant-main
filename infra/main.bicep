targetScope = 'subscription'

@description('Azure region for all resources.')
param location string

@description('Name of the single resource group holding everything.')
param resourceGroupName string

@description('Emails to notify on budget alerts, at 20% ($1 of a $5 budget) and 100%.')
param budgetAlertEmails array

@description('Monthly budget amount in USD. See docs/AZURE.md guardrails.')
param budgetAmount int = 5

@description('Tenant ID that owns the Key Vault.')
param tenantId string

@description('Globally unique Key Vault name.')
param keyVaultName string

@description('Globally unique Static Web App name.')
param staticWebAppName string

@description('Budget start date, first of the current month. utcNow() is only valid as a param default.')
param budgetStartDate string = '${utcNow('yyyy-MM')}-01'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
}

module budget 'modules/budget.bicep' = {
  name: 'budget'
  scope: rg
  params: {
    budgetName: '${resourceGroupName}-budget'
    amount: budgetAmount
    alertEmails: budgetAlertEmails
    startDate: budgetStartDate
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyVault'
  scope: rg
  params: {
    location: location
    keyVaultName: keyVaultName
    tenantId: tenantId
  }
}

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticWebApp'
  scope: rg
  params: {
    location: location
    staticWebAppName: staticWebAppName
  }
}

output vaultUri string = keyVault.outputs.vaultUri
output staticWebAppHostname string = staticWebApp.outputs.defaultHostname
