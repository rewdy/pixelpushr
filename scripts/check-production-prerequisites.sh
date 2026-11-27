#!/usr/bin/env bash
set -euo pipefail

region=us-east-1
session_secret=pixelpushr-production-us-east-1/session-encryption

if ! metadata="$(aws secretsmanager describe-secret --region "$region" --secret-id "$session_secret" --output json)"; then
  echo "Cannot verify required Secrets Manager secret $session_secret in $region. Check that it exists and that the deploy role can describe it." >&2
  exit 1
fi

if ! jq -e '.DeletedDate == null and ((.VersionIdsToStages // {}) | any(.[]; index("AWSCURRENT") != null))' <<< "$metadata" > /dev/null; then
  echo "Required Secrets Manager secret $session_secret must have an active AWSCURRENT version and must not be scheduled for deletion." >&2
  exit 1
fi
