#!/bin/bash
mkdir -p certs
openssl genrsa -out certs/private.key 2048
openssl rsa -in certs/private.key -pubout -out certs/public.key

echo "✅ Keys generated in /certs"
echo "Add these to your .env file (as single-line strings with \n):"
echo ""
echo "JWT_PRIVATE_KEY=\"$(awk '{printf "%s\\n", $0}' certs/private.key)\""
echo "JWT_PUBLIC_KEY=\"$(awk '{printf "%s\\n", $0}' certs/public.key)\""