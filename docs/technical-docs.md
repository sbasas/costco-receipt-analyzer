# Costco Receipt Analyzer - Technical Documentation

## Project Overview
The Costco Receipt Analyzer is a serverless application that allows users to upload Costco receipts, extract item information, and track prices over time. The system uses AWS services to provide a scalable and secure solution.

## Architecture

### AWS Services Used
- **AWS CDK**: Infrastructure as Code
- **Amazon S3**: Receipt storage
- **AWS Lambda**: Receipt processing
- **Amazon Textract**: Receipt text extraction
- **Amazon Timestream**: Time-series data storage
- **Amazon Cognito**: User authentication

### System Flow
1. User uploads receipt to S3
2. S3 triggers Lambda function
3. Lambda uses Textract to extract text
4. Lambda parses receipt data
5. Data is stored in Timestream
6. User can search and analyze price history

## Setup Process

### 1. Initial Setup
```bash
# Create project directory
mkdir costco-receipt-analyzer
cd costco-receipt-analyzer

# Initialize CDK project
npx aws-cdk init app --language typescript

# Install dependencies
npm install aws-cdk-lib @aws-sdk/client-cognito-identity-provider @aws-sdk/client-s3 @aws-sdk/client-timestream-write
```

### 2. AWS Configuration
```bash
# Configure AWS CLI with credentials
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region
# - Output format (json)

# Bootstrap CDK
cdk bootstrap
```

### 3. Infrastructure Components

#### S3 Bucket Configuration
- Encrypted storage for receipts
- CORS enabled for web access
- Versioning enabled
- Lifecycle rules for cost optimization

```typescript
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
```

#### Timestream Database
- Separate memory and magnetic storage tiers
- 24-hour memory retention
- 365-day magnetic storage retention

```typescript
const databaseName = `costco_receipts_${this.account}_${this.region}`;
this.timestreamDatabase = new timestream.CfnDatabase(this, 'ReceiptDatabase', {
  databaseName: databaseName,
});

this.timestreamTable = new timestream.CfnTable(this, 'ReceiptTable', {
  databaseName: databaseName,
  tableName: 'receipt_items',
  retentionProperties: {
    MemoryStoreRetentionPeriodInHours: '24',
    MagneticStoreRetentionPeriodInDays: '365',
  },
});
```

### 4. Lambda Function Implementation

#### Function Structure
```
lambda/
└── receipt-processor/
    ├── src/
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

#### Receipt Processing Logic
1. Extract text using Textract
2. Parse item information
   - Item numbers
   - Item names
   - Prices
3. Save to Timestream
4. Handle errors and retries

Key Processing Code:
```typescript
// Match item number and name (e.g., "48757 SPRING MIX")
const itemMatch = currentLine.match(/^(\d+)\s+(.+)$/);
      
if (itemMatch) {
  // Check if next line contains the price (e.g., "3.89 3")
  const priceMatch = nextLine.match(/^(\d+[.,]\d{2})\s*\d?$/);
  
  if (priceMatch) {
    const [, itemNumber, itemName] = itemMatch;
    const price = parseFloat(priceMatch[1].replace(',', '.'));
    
    items.push({
      itemNumber,
      itemName: itemName.trim(),
      price
    });
  }
}
```

### 5. IAM Permissions

#### Lambda Function Permissions
```typescript
receiptProcessor.addToRolePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    'textract:AnalyzeDocument',
    'textract:DetectDocumentText',
  ],
  resources: ['*'],
}));

receiptProcessor.addToRolePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    'timestream:WriteRecords',
    'timestream:DescribeEndpoints',
    'timestream:SelectValues',
    'timestream:DescribeTable',
    'timestream:DescribeDatabase'
  ],
  resources: ['*'],
}));
```

## Data Formats

### Receipt Item Structure
```typescript
interface ReceiptItem {
  itemNumber: string;  // Costco item number
  itemName: string;    // Product name
  price: number;       // Item price
}
```

### Timestream Record Structure
```typescript
{
  Dimensions: [
    { Name: 'user_id', Value: userId },
    { Name: 'item_number', Value: itemNumber },
    { Name: 'item_name', Value: itemName }
  ],
  MeasureName: 'price',
  MeasureValue: price.toString(),
  MeasureValueType: 'DOUBLE',
  Time: timestamp
}
```

## Deployment Process

### 1. Build Lambda Function
```bash
cd lambda/receipt-processor
npm run package
cd ../..
```

### 2. Deploy Infrastructure
```bash
cdk deploy
```

### 3. Test Receipt Upload
```bash
aws s3 cp receipt.pdf s3://bucket-name/user123/receipt.pdf
```

### 4. Query Data
```bash
aws timestream-query query --query-string "
  SELECT * 
  FROM \"costco_receipts_945209085584_us-east-1\".\"receipt_items\" 
  ORDER BY time DESC 
  LIMIT 100"
```

## Security Considerations

1. **Authentication**
   - Cognito user pools for authentication
   - Secure password policies
   - Email verification

2. **Data Security**
   - S3 server-side encryption
   - IAM least privilege principle
   - Secure API access

3. **Monitoring**
   - Lambda function logs
   - S3 access logs
   - Timestream query logs

## Future Enhancements

1. **Frontend Interface**
   - Upload receipts
   - View receipt history
   - Search functionality

2. **Price Analytics**
   - Price trend visualization
   - Price alerts
   - Cost analytics

3. **Receipt Management**
   - Receipt categorization
   - Export functionality
   - Bulk upload support

## Troubleshooting

### Common Issues and Solutions

1. **Lambda Permission Errors**
   - Check IAM roles
   - Verify policy statements
   - Ensure service endpoints are accessible

2. **Receipt Processing Errors**
   - Validate PDF format
   - Check Textract response
   - Verify parsing patterns

3. **Timestream Issues**
   - Check database/table existence
   - Verify write permissions
   - Monitor query performance

## Maintenance

### Regular Tasks
1. Monitor S3 storage usage
2. Review Lambda function logs
3. Optimize Timestream queries
4. Update dependencies
5. Review security configurations

### Backup Strategy
1. S3 versioning for receipts
2. Timestream data retention
3. Regular infrastructure backups