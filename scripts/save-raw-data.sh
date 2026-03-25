#!/bin/bash
# This script creates the raw data file from stdin
# Usage: paste the raw Wix data and press Ctrl+D
cat > scripts/nil-tracker-raw.txt
echo "Saved $(wc -l < scripts/nil-tracker-raw.txt) lines"
