#!/bin/bash
# Sourced by docker_run.sh. Loads dd-trace in node when DD_APM_ENABLED is true.

case "${DD_APM_ENABLED,,}" in
  y | yes | t | true | on | 1)
    export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import dd-trace/initialize.mjs"
    ;;
esac
