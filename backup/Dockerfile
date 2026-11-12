# Nightly encrypted backup of Bloom's Postgres to a private Railway Bucket.
# pg_dump 17 matches the database (supabase/postgres 17).
FROM postgres:17-alpine
RUN apk add --no-cache aws-cli openssl
COPY backup.sh /usr/local/bin/backup.sh
CMD ["sh", "/usr/local/bin/backup.sh"]
