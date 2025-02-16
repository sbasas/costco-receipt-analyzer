# Costco Receipt Analyzer

A serverless application that analyzes Costco receipts to track prices and item history using AWS services.

## Architecture

- AWS CDK for infrastructure
- Amazon S3 for receipt storage
- AWS Lambda for receipt processing
- Amazon Textract for text extraction
- Amazon Timestream for price history
- Amazon Cognito for authentication

## Prerequisites

- Node.js (v18.x or later)
- AWS CLI configured
- AWS CDK CLI installed
- TypeScript

## Setup

1. Clone the repository:
```bash
git clone [your-repo-url]
cd costco-receipt-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Bootstrap CDK (first time only):
```bash
cdk bootstrap
```

4. Deploy the stack:
```bash
cdk deploy
```

## Project Structure

```
costco-receipt-analyzer/
├── bin/                          # CDK app entry point
├── lib/                          # CDK stack definition
├── lambda/                       # Lambda functions
│   └── receipt-processor/        # Receipt processing function
│       ├── src/                 # TypeScript source code
│       ├── dist/                # Compiled JavaScript
│       └── package.json         # Dependencies
├── docs/                         # Documentation
├── test/                         # Test files
├── cdk.json                      # CDK configuration
├── package.json                  # Project dependencies
└── tsconfig.json                # TypeScript configuration
```

## Documentation

For detailed documentation, see the [docs](./docs) directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Your chosen license]
