#!/usr/bin/env python3
"""
Ratefluencer API Test Suite
Tests all endpoints that don't require external APIs
"""

import requests
import json
import sys

BASE_URL = 'http://localhost:5000'

tests_passed = 0
tests_failed = 0
test_results = []

def test_endpoint(method, path, data=None, description=""):
    global tests_passed, tests_failed
    try:
        if method == "GET":
            response = requests.get(f'{BASE_URL}{path}', timeout=5)
        else:
            response = requests.post(f'{BASE_URL}{path}', json=data, timeout=5)
        
        if response.status_code in [200, 201]:
            tests_passed += 1
            result = f"✓ PASS | {method:4} {path:40} | {description}"
            test_results.append(result)
            return True
        else:
            tests_failed += 1
            result = f"✗ FAIL | {method:4} {path:40} | Status: {response.status_code}"
            test_results.append(result)
            return False
    except Exception as e:
        tests_failed += 1
        result = f"✗ FAIL | {method:4} {path:40} | Error: {str(e)[:50]}"
        test_results.append(result)
        return False

print("\n" + "="*90)
print("RATEFLUENCER API TEST SUITE - Non-API-Dependent Features")
print("="*90 + "\n")

# Test Group 1: Search & Discovery
print("[TEST GROUP 1] Search & Discovery Endpoints")
test_endpoint("GET", "/api/stats", description="Platform statistics")
test_endpoint("GET", "/api/influencers", description="List all creators (paginated)")
test_endpoint("GET", "/api/influencers?category=Beauty", description="Filter creators by category")
test_endpoint("GET", "/api/real-creators", description="Top creators by category")
test_endpoint("GET", "/api/search?q=fitness", description="Full-text search - fitness")
test_endpoint("GET", "/api/search?q=beauty", description="Full-text search - beauty")

# Test Group 2: ML Scoring & Prediction (No API required - uses trained models)
print("\n[TEST GROUP 2] ML Scoring & Predictions (Trained Models)")
test_endpoint("POST", "/api/viral-predict", {
    "caption": "Check out my new fitness routine! Transform your body in 30 days",
    "hashtags": "#fitness #gym #workout #transformation #fitnessmotivation",
    "category": "Fitness"
}, "Viral prediction for fitness content")

test_endpoint("POST", "/api/viral-predict", {
    "caption": "New season trends are here! Must-have pieces for fall",
    "hashtags": "#fashion #style #trending #fashionblogger #ootd",
    "category": "Fashion"
}, "Viral prediction for fashion content")

test_endpoint("POST", "/api/score-caption", {
    "caption": "Amazing new product launch! Limited time offer",
    "hashtags": "#product #launch #exclusive"
}, "Caption engagement scoring")

test_endpoint("POST", "/api/score-caption", {
    "caption": "Summer vibes only! Check this out",
    "hashtags": "#summer #vibes #beachlife"
}, "Caption scoring - casual tone")

# Test Group 3: Analytics & Insights
print("\n[TEST GROUP 3] Analytics & Insights")
test_endpoint("GET", "/api/platform-insights", description="Platform-wide insights")

test_endpoint("POST", "/api/trend-ranking", {
    "category": "Fashion"
}, "Trend ranking - Fashion")

test_endpoint("POST", "/api/trend-ranking", {
    "category": "Fitness"
}, "Trend ranking - Fitness")

# Test Group 4: Matching & Discovery (ML-based, no API)
print("\n[TEST GROUP 4] Creator Matching & Discovery")
test_endpoint("POST", "/api/creator-match", {
    "brand_niche": "Fitness",
    "engagement_goal": "Conversion"
}, "Match creators for Fitness conversion campaign")

test_endpoint("POST", "/api/creator-match", {
    "brand_niche": "Beauty",
    "engagement_goal": "Awareness"
}, "Match creators for Beauty awareness campaign")

# Test Group 5: Health Checks
print("\n[TEST GROUP 5] Diagnostics & Health Checks")
test_endpoint("GET", "/api/groq-status", description="Groq API status check")

# Summary Report
print("\n" + "="*90)
print("TEST RESULTS SUMMARY")
print("="*90)
for result in test_results:
    print(result)

print("\n" + "="*90)
print(f"TOTAL: {tests_passed} PASSED | {tests_failed} FAILED | Success Rate: {(tests_passed/(tests_passed+tests_failed)*100):.1f}%")
print("="*90 + "\n")

if tests_failed > 0:
    print("WARNING: Some tests failed. Check backend logs for details.")
    sys.exit(1)
else:
    print("SUCCESS: All tests passed! All non-API features are working.")
    sys.exit(0)
