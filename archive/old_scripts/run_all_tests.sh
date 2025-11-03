#!/bin/bash
# Run all tests for the Family Meal Planner

# Use python3 explicitly
PYTHON=python3

echo "======================================================================"
echo "Family Meal Planner - Complete Test Suite"
echo "======================================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Database Setup
echo -e "${BLUE}Test 1: Database Initialization${NC}"
$PYTHON setup.py > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 2: Core Functions
echo -e "${BLUE}Test 2: Core meal_planner.py Functions${NC}"
$PYTHON -c "
from meal_planner import MealPlannerDB
db = MealPlannerDB()
assert len(db.get_meals_by_type('dinner')) > 0
assert len(db.get_kid_friendly_meals()) > 0
assert len(db.search_meals('chicken')) > 0
db.close()
" 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 3: CLI
echo -e "${BLUE}Test 3: CLI Commands${NC}"
$PYTHON cli.py --stats > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 4: Flask API
echo -e "${BLUE}Test 4: Flask API Endpoints${NC}"
$PYTHON test_app.py > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 5: AI Parser Validation
echo -e "${BLUE}Test 5: AI Recipe Parser Validation${NC}"
$PYTHON test_ai_parser.py > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 6: Integration
echo -e "${BLUE}Test 6: Integration Test${NC}"
$PYTHON test_integration.py > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Summary
echo "======================================================================"
echo -e "${BLUE}Test Summary${NC}"
echo "======================================================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "Your Family Meal Planner is ready to use!"
    echo "Run: python3 app.py"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi
