import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as timestream from 'aws-cdk-lib/aws-timestream';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CostcoReceiptAnalyzerStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly receiptBucket: s3.Bucket;
  public readonly timestreamDatabase: timestream.CfnDatabase;
  public readonly timestreamTable: timestream.CfnTable;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for receipt storage
    this.receiptBucket = new s3.Bucket(this, 'ReceiptBucket', {
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'ReceiptUserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Create Cognito App Client
    const userPoolClient = new cognito.UserPoolClient(this, 'ReceiptUserPoolClient', {
      userPool: this.userPool,
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
    });

    // Create Timestream database with a unique name
    const databaseName = `costco_receipts_${this.account}_${this.region}`;
    this.timestreamDatabase = new timestream.CfnDatabase(this, 'ReceiptDatabase', {
      databaseName: databaseName,
    });

    // Create Timestream table with explicit dependency
    this.timestreamTable = new timestream.CfnTable(this, 'ReceiptTable', {
      databaseName: databaseName,
      tableName: 'receipt_items',
      retentionProperties: {
        MemoryStoreRetentionPeriodInHours: '24',
        MagneticStoreRetentionPeriodInDays: '365',
      },
    });

    // Add explicit dependency
    this.timestreamTable.addDependency(this.timestreamDatabase);

    // Create Lambda function for processing receipts
    const receiptProcessor = new lambda.Function(this, 'ReceiptProcessor', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/receipt-processor/build'),
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        TIMESTREAM_DATABASE_NAME: databaseName,
        TIMESTREAM_TABLE_NAME: 'receipt_items',
      },
    });

    // Add Textract permissions
    receiptProcessor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'textract:AnalyzeDocument',
        'textract:DetectDocumentText',
      ],
      resources: ['*'],
    }));

    // Add Timestream permissions
    receiptProcessor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'timestream:WriteRecords',
        'timestream:DescribeEndpoints',
        'timestream:SelectValues',
        'timestream:DescribeTable',
        'timestream:DescribeDatabase'
      ],
      resources: ['*'],  // You can restrict this to specific Timestream resources if needed
    }));

    // Grant S3 read permissions
    this.receiptBucket.grantRead(receiptProcessor);
    // Add S3 trigger for Lambda
    this.receiptBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(receiptProcessor)
    );

    // Output important values
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.receiptBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'TimestreamDatabaseName', {
      value: databaseName,
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: receiptProcessor.functionName,
    });
  }
}