#!/bin/bash
# c.sh <METHOD> <path> [json] — chama a API como a persona cliente, renovando o access token quando faltar < 90s.
QA=/private/tmp/claude-501/-Users-jvsen-Desktop-jobs-projects-mobile-judeu/eda8797b-ed67-44d4-87dd-774c818dab53/scratchpad/qa
TF=$QA/cliente/tokens.json
AT=$(node -e "const t=require('$TF');console.log(t.accessToken)")
EXP=$(node -e "const t=require('$TF');console.log(JSON.parse(Buffer.from(t.accessToken.split('.')[1],'base64').toString()).exp)")
NOW=$(date +%s)
if [ $((EXP - NOW)) -lt 90 ]; then
  RT=$(node -e "const t=require('$TF');console.log(t.refreshToken)")
  R=$(curl -s -X POST http://localhost:3001/api/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT\"}")
  node -e "const r=$R; if(!r.accessToken){console.error('REFRESH FAIL',JSON.stringify(r));process.exit(1)}; require('fs').writeFileSync('$TF',JSON.stringify({accessToken:r.accessToken,refreshToken:r.refreshToken},null,1))" || exit 1
  AT=$(node -e "const t=require('$TF');console.log(t.accessToken)")
  echo "[c.sh] token renovado" >&2
fi
exec $QA/api.sh "$1" "$2" "$3" "$AT"
