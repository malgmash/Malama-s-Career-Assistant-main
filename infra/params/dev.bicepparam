using '../main.bicep'

param location = 'eastus2'
param resourceGroupName = 'rg-malama-career-dev'
param budgetAlertEmails = [
  '<INSERT-EMAIL>'
]
param budgetAmount = 5
param tenantId = '<INSERT-AZURE-TENANT-ID>'
param keyVaultName = 'kv-malama-career-dev'
param staticWebAppName = 'swa-malama-career-dev'
