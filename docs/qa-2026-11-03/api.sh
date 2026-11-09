#!/bin/bash
# Uso: api.sh <METHOD> <path> [json-body] [token]
# Ex.: api.sh POST /api/auth/login '{"email":"x","password":"y"}'
#      api.sh GET /api/orders?as=provider '' "$TOKEN"
BASE=${API_BASE:-http://localhost:3001}
M=$1; P=$2; B=$3; T=$4
ARGS=(-s -S -X "$M" "$BASE$P" -H "Content-Type: application/json" -w '\nHTTP %{http_code} %{time_total}s\n')
[ -n "$B" ] && ARGS+=(-d "$B")
[ -n "$T" ] && ARGS+=(-H "Authorization: Bearer $T")
curl "${ARGS[@]}"
