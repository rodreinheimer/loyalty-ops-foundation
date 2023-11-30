############################################################################
# Testing lambda/api locally: 
# Required software:
#   . sam cli (https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) 
#   . docker (https://docs.docker.com/get-docker/)
############################################################################
# << PreTest >>
# 1. Init Modules (required)
#   1.1. Change directory: cd <PROJECT_ROOT>/layers/loyalty-ops-layer-modules/scripts/deploy
#   1.2. Execute build script: ./delta_build.sh
#       script will execute 'npm install --save-dev' which will create/update node_modules directory
#
# 2. Set-up S3 Report Bucket (optional*)
#   2.1 You can name bucket anything. I use 'loyalty-ops-foundation-report-test'
#   * you don't need a bucket if you're testing logic before put to bucket
#
# << Test >>
# 3. If test exclude put to s3 bucket
#   Run sam command:
############################################################################


############################################################################
# Invoke LOCAL (ReportGenerateFunction)
############################################################################
sam local invoke "ReportGenerateFunction" \
-e ./events/skx-us-order-report.json --region us-west-1

############################################################################
# Invoke LOCAL (ReportNotificationFunction)
############################################################################
sam local invoke "ReportNotificationFunction" \
-e ./events/skx-us-order-report-notify.json --region us-west-1

############################################################################
# Invoke REMOTE (ReportNotificationFunction)
############################################################################
aws lambda invoke --function-name loyalty-ops-function-report-default-dev \
--invocation-type Event --payload '{"brand": "skx", "region": "us", "reportId": "ORDERS_REPORT"}' \
--region us-west-1 response.json

############################################################################
# Delete Layer Version
############################################################################
aws lambda delete-layer-version --layer-name \
loyalty-ops-configurations-dev --version-number 4




