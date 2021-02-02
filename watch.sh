#!/bin/sh
fswatch -t0 "dist/main.js" | \
    xargs -0 -n1 -I '{}' sh -c 'echo "\n\033[35m[{}]\033[0m"; time node --max-old-space-size=4096 dist/main.js'
