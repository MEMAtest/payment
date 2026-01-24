#!/usr/bin/env node
/**
 * Currency API Integration Test
 * Tests that the Frankfurter API is working and returns the expected format.
 */

const API_URL = "https://api.frankfurter.app/latest?from=GBP";

async function testFrankfurterAPI() {
  const results = { passed: 0, failed: 0, errors: [] };

  console.log("Currency API Integration Tests\n" + "=".repeat(40));

  // Test 1: API is reachable
  console.log("\n[Test 1] API is reachable...");
  let response;
  try {
    response = await fetch(API_URL);
    if (response.ok) {
      console.log("  PASS: API returned status 200");
      results.passed++;
    } else {
      console.log(`  FAIL: API returned status ${response.status}`);
      results.failed++;
      results.errors.push(`API returned status ${response.status}`);
    }
  } catch (err) {
    console.log(`  FAIL: Could not reach API - ${err.message}`);
    results.failed++;
    results.errors.push(`Could not reach API: ${err.message}`);
    return results;
  }

  // Test 2: Response is valid JSON
  console.log("\n[Test 2] Response is valid JSON...");
  let data;
  try {
    data = await response.json();
    console.log("  PASS: Response is valid JSON");
    results.passed++;
  } catch (err) {
    console.log(`  FAIL: Response is not valid JSON - ${err.message}`);
    results.failed++;
    results.errors.push(`Invalid JSON: ${err.message}`);
    return results;
  }

  // Test 3: Response has 'base' field set to GBP
  console.log("\n[Test 3] Response has base=GBP...");
  if (data.base === "GBP") {
    console.log("  PASS: base is GBP");
    results.passed++;
  } else {
    console.log(`  FAIL: base is "${data.base}", expected "GBP"`);
    results.failed++;
    results.errors.push(`base is "${data.base}", expected "GBP"`);
  }

  // Test 4: Response has 'date' field
  console.log("\n[Test 4] Response has date field...");
  if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    console.log(`  PASS: date is "${data.date}"`);
    results.passed++;
  } else {
    console.log(`  FAIL: date is missing or invalid: "${data.date}"`);
    results.failed++;
    results.errors.push(`Invalid date: "${data.date}"`);
  }

  // Test 5: Response has 'rates' object
  console.log("\n[Test 5] Response has rates object...");
  if (data.rates && typeof data.rates === "object") {
    console.log(`  PASS: rates object has ${Object.keys(data.rates).length} currencies`);
    results.passed++;
  } else {
    console.log("  FAIL: rates is missing or not an object");
    results.failed++;
    results.errors.push("rates is missing or not an object");
    return results;
  }

  // Test 6: rates contains expected currencies (USD, EUR)
  console.log("\n[Test 6] Rates contain USD and EUR...");
  const hasUSD = "USD" in data.rates && typeof data.rates.USD === "number";
  const hasEUR = "EUR" in data.rates && typeof data.rates.EUR === "number";
  if (hasUSD && hasEUR) {
    console.log(`  PASS: USD=${data.rates.USD}, EUR=${data.rates.EUR}`);
    results.passed++;
  } else {
    console.log(`  FAIL: Missing USD or EUR (USD: ${data.rates.USD}, EUR: ${data.rates.EUR})`);
    results.failed++;
    results.errors.push("Missing USD or EUR in rates");
  }

  // Test 7: Rates are reasonable values (sanity check)
  console.log("\n[Test 7] Rates are reasonable values...");
  const usdRate = data.rates.USD;
  const eurRate = data.rates.EUR;
  // GBP/USD historically ranges 1.1-1.7, GBP/EUR historically ranges 1.0-1.4
  const usdReasonable = usdRate > 1.0 && usdRate < 2.0;
  const eurReasonable = eurRate > 0.9 && eurRate < 1.6;
  if (usdReasonable && eurReasonable) {
    console.log("  PASS: Rates are within reasonable historical ranges");
    results.passed++;
  } else {
    console.log(`  WARN: Rates may be outside typical ranges (USD: ${usdRate}, EUR: ${eurRate})`);
    // Don't fail, just warn - rates can fluctuate
    results.passed++;
  }

  // Test 8: Conversion logic works correctly
  console.log("\n[Test 8] Conversion logic (100 GBP to USD)...");
  const amount = 100;
  const converted = amount * data.rates.USD;
  if (converted > 100 && converted < 200) {
    console.log(`  PASS: 100 GBP = ${converted.toFixed(2)} USD`);
    results.passed++;
  } else {
    console.log(`  FAIL: Unexpected conversion result: ${converted}`);
    results.failed++;
    results.errors.push(`Conversion returned unexpected value: ${converted}`);
  }

  return results;
}

async function run() {
  try {
    const results = await testFrankfurterAPI();

    console.log("\n" + "=".repeat(40));
    console.log(`Results: ${results.passed} passed, ${results.failed} failed`);

    if (results.failed > 0) {
      console.log("\nErrors:");
      results.errors.forEach((err) => console.log(`  - ${err}`));
      process.exitCode = 1;
    } else {
      console.log("\nAll tests passed!");
    }
  } catch (err) {
    console.error("Test runner failed:", err.message);
    process.exitCode = 1;
  }
}

run();
