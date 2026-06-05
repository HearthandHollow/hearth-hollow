#!/bin/bash

echo "Testing delete quote functionality via API..."
echo ""

# Login first
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"adminpass"}')

echo "Login response: $LOGIN_RESPONSE"
echo ""

# Get list of quotes
echo "2. Fetching quotes..."
QUOTES_RESPONSE=$(curl -s -b cookies.txt http://localhost:3001/api/admin/quotes)
echo "Quotes response (first 500 chars): ${QUOTES_RESPONSE:0:500}"
echo ""

# Extract first quote ID from response
QUOTE_ID=$(echo "$QUOTES_RESPONSE" | grep -oP '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$QUOTE_ID" ]; then
  echo "No quotes found to delete"
  exit 1
fi

echo "3. Found quote ID: $QUOTE_ID"
echo ""

# Delete the quote
echo "4. Deleting quote..."
DELETE_RESPONSE=$(curl -s -b cookies.txt -X DELETE http://localhost:3001/api/admin/quotes/$QUOTE_ID/delete)
echo "Delete response: $DELETE_RESPONSE"
echo ""

# Check if deletion was successful
if echo "$DELETE_RESPONSE" | grep -q "deleted successfully"; then
  echo "✓ Quote deleted successfully!"
  exit 0
else
  echo "✗ Failed to delete quote"
  exit 1
fi
