param budgetName string
param amount int
param alertEmails array
param startDate string

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
    notifications: {
      alert20Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 20
        contactEmails: alertEmails
      }
      alert100Percent: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        contactEmails: alertEmails
      }
    }
  }
}
