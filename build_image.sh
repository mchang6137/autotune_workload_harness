#! /bin/bash

TARGET="$1"

docker build -t mchang6137/$TARGET -f $TARGET/Dockerfile .
docker push  mchang6137/$TARGET
