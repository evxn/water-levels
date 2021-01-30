#!/bin/sh
fswatch -t0 "dist/main.js" | \
    xargs -0 -n1 -I '{}' sh -c 'echo "\n\033[35m[{}]\033[0m"; node dist/main.js'