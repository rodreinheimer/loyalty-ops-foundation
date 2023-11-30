#!/bin/bash
set -eo pipefail

###########################################################################
# Build and deploy report foundation stack 
###########################################################################
ENV_NAME=$1
DEPLOYMENT_BUCKET=$2
ROOT_DIR=$3

if [[ ! -z $1 ]] && [[ $1 != "prd" && $1 != "dev" ]]; then
   echo "ENV_NAME Parameter provided but not matching required values [${1}] Error will fail ..."
   exit 99
fi

###########################################################################
# Script running without environment variable assumed to be running by 
# the developer in which case env defaults to test the bucket would be 
# created by create-stack-bucket.sh. The environment variable is defined 
# in pipeline.yml and the bucket must be created and is defined at 
# template.yml.
###########################################################################
if [[ "dev,prd" =~ ${ENV_NAME} ]]; then 
    STACK_BUCKET=${DEPLOYMENT_BUCKET}-${ENV_NAME};
    STACK_NAME="loyalty-ops-foundation-iac-"${ENV_NAME};
fi

# Build node-module
cd ../../layers/loyalty-ops-layer-modules/scripts/deploy
chmod 755 build.sh && ./build.sh ${ENV_NAME} ${DEPLOYMENT_BUCKET}

# Remove generated for node-module zip used in delta deploys
rm -f ../../layer_delta.zip

# Back to root directory
cd ../../../..

echo loyalty-ops-foundation package ${STACK_BUCKET} 
# Build stack package
aws cloudformation package \
--template-file template.yml \
--s3-bucket ${STACK_BUCKET} \
--output-template-file out.yml

echo loyalty-ops-foundation deploy ${STACK_NAME} 
# Deploy stack package
aws cloudformation deploy \
--template-file out.yml \
--stack-name ${STACK_NAME} \
--capabilities CAPABILITY_NAMED_IAM \
--parameter-overrides EnvType=${ENV_NAME} 

