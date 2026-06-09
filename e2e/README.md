To run the complete e2e test, use the following command:

1) make sure all of the backend services are running
2) Update the keycloak admin credentials in e2e/fixtures/test-data.ts
3) Run the following command:

```npx playwright test e2e/specs/full-journey.spec.ts --config=e2e/playwright.config.ts --reporter=list```

4) Results will be in the .playwright directory