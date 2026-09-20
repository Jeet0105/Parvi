#!/bin/bash
# Creates the dedicated test database alongside the main one.
# Tests must never run against the development database.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE ${POSTGRES_DB}_test;
EOSQL
