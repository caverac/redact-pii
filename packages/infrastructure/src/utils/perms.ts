export const Dynamo_READ_DATA_ACTIONS = [
  'dynamodb:BatchGetItem',
  'dynamodb:GetRecords',
  'dynamodb:GetShardIterator',
  'dynamodb:Query',
  'dynamodb:GetItem',
  'dynamodb:Scan'
]

export const Dynamo_WRITE_DATA_ACTIONS = [
  'dynamodb:BatchWriteItem',
  'dynamodb:PutItem',
  'dynamodb:UpdateItem',
  'dynamodb:DeleteItem'
]

export const API_INVOKE = ['execute-api:Invoke']

export const S3_READ_ACCESS = [
  's3:ListBucket',
  's3:GetObject',
  's3:GetObjectTagging',
  's3:GetObjectVersionTagging'
]

export const S3_WRITE_ACCESS = [
  's3:ListBucket',
  's3:PutObject',
  's3:PutObjectAcl',
  's3:DeleteObject',
  's3:DeleteObjectVersion',
  's3:DeleteObjectTagging',
  's3:DeleteObjectVersionTagging',
  's3:PutObjectTagging',
  's3:PutObjectVersionTagging',
  's3:CopyObject'
]

export const SecretsManager_READ_ACCESS = ['secretsmanager:GetSecretValue']

export const SSM_READ_ACCESS = ['ssm:GetParameter']
