#!/bin/bash
set -eo pipefail

# Prepare logging
LOG_ID=$(dd if=/dev/random bs=8 count=1 2>/dev/null | od -An -tx1 | tr -d ' \t\n')
echo "logid: execution_$LOG_ID.log"

exit 99;

# get-function returns layer asssociations
aws lambda get-function \
--function-name  loyalty-ops-function-report-default-dev

aws lambda get-function \
--function-name  loyalty-ops-function-notify-default-dev

# latest layer filtered by layer name 
aws lambda list-layers | grep loyalty-ops-utilities-dev

# update-function-configuration allows new asssociations
aws lambda update-function-configuration \
--function-name loyalty-ops-function-notify-default-dev \
--layers arn:aws:lambda:us-west-1:343224624564:layer:loyalty-ops-modules-dev:25 \
arn:aws:lambda:us-west-1:343224624564:layer:loyalty-ops-configurations-dev:53 \
arn:aws:lambda:us-west-1:343224624564:layer:loyalty-ops-utilities-dev:73

aws lambda update-function-configuration \
--function-name loyalty-ops-function-report-default-dev \
--layers arn:aws:lambda:us-west-1:343224624564:layer:loyalty-ops-modules-dev:25 \
arn:aws:lambda:us-west-1:343224624564:layer:loyalty-ops-configurations-dev:53 \
arn:aws:lambda:us-west-1:343224624564:layer:loyalty-ops-utilities-dev:73