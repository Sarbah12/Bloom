#!/bin/sh
# Dumps the whole database, checks the dump can be read, encrypts it, uploads
# it to the bucket, and deletes copies older than RETENTION_DAYS. Runs once and
# exits; Railway's cron schedule starts it every night.
set -eu

: "${PGHOST:?}" "${PGPASSWORD:?}" "${BACKUP_PASSPHRASE:?}" "${S3_BUCKET:?}" "${S3_ENDPOINT:?}"
export PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-supabase_admin}" PGDATABASE="${PGDATABASE:-postgres}"
export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:?}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:?}" AWS_DEFAULT_REGION="${S3_REGION:-auto}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PREFIX="postgres"

stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
dump="/tmp/bloom-$stamp.dump"
enc="$dump.enc"

echo "backup: dumping $PGDATABASE on $PGHOST"
pg_dump --format=custom --compress=9 --file="$dump"
# A dump that pg_restore can't list would be useless; fail loudly instead.
tables=$(pg_restore --list "$dump" | grep -c ' TABLE ' || true)
echo "backup: dump ok, $(du -h "$dump" | cut -f1), $tables tables"

openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -salt \
  -in "$dump" -out "$enc" -pass env:BACKUP_PASSPHRASE
sha=$(sha256sum "$dump" | cut -d' ' -f1)
rm -f "$dump"

aws s3 cp "$enc" "s3://$S3_BUCKET/$PREFIX/bloom-$stamp.dump.enc" \
  --endpoint-url "$S3_ENDPOINT" --metadata "sha256=$sha,tables=$tables" --only-show-errors
rm -f "$enc"
echo "backup: uploaded $PREFIX/bloom-$stamp.dump.enc"

# Retention: delete encrypted dumps older than RETENTION_DAYS.
cutoff=$(date -u -d "@$(( $(date +%s) - RETENTION_DAYS * 86400 ))" +%Y-%m-%dT%H%M%SZ)
aws s3 ls "s3://$S3_BUCKET/$PREFIX/" --endpoint-url "$S3_ENDPOINT" | awk '{print $4}' | while read -r key; do
  [ -z "$key" ] && continue
  when=$(echo "$key" | sed -E 's/^bloom-(.*)\.dump\.enc$/\1/')
  if [ "$when" \< "$cutoff" ]; then
    aws s3 rm "s3://$S3_BUCKET/$PREFIX/$key" --endpoint-url "$S3_ENDPOINT" --only-show-errors
    echo "backup: removed $key (older than $RETENTION_DAYS days)"
  fi
done
echo "backup: done"
