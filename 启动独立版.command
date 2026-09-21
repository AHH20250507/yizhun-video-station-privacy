#!/bin/zsh
cd "$(dirname "$0")"
open "http://127.0.0.1:8795/"
python3 server_no_cache.py
