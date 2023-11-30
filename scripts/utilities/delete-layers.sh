#!/bin/bash
set -eo pipefail

echo "this utility is to help clean up assets. If you intend to clear make sure you set layer name versions to delete and comment out the exit code"
exit 99;

END=25
for i in $(seq 1 $END); 
do 
#aws lambda delete-layer-version --layer-name {LAYER_NAME} --version-number ${i}
done
