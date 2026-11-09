#!/bin/bash
# imprime access token válido do helper; renova via refresh (rotação gravada)
QA=/private/tmp/claude-501/-Users-jvsen-Desktop-jobs-projects-mobile-judeu/eda8797b-ed67-44d4-87dd-774c818dab53/scratchpad/qa
F=${1:-h}   # prefixo: h (helper) ou cli (cliente descartável)
REF=$(cat $QA/$F-refresh.txt)
OUT=$($QA/api.sh POST /api/auth/refresh "{\"refreshToken\":\"$REF\"}")
AT=$(echo "$OUT" | head -1 | python3 -c "import sys,json;d=json.loads(sys.stdin.readline());print(d.get('accessToken',''))")
RT=$(echo "$OUT" | head -1 | python3 -c "import sys,json;d=json.loads(sys.stdin.readline());print(d.get('refreshToken',''))")
[ -n "$AT" ] && echo "$AT" > $QA/$F-token.txt
[ -n "$RT" ] && echo "$RT" > $QA/$F-refresh.txt
cat $QA/$F-token.txt
